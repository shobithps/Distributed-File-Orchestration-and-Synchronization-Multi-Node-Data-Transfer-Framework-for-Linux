import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { FaUserCircle } from "react-icons/fa"; // Import the profile icon

import Swal from "sweetalert2";

const MainWindow = () => {
  const socket = useSocket();
  const { username } = useParams();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [viewContent, setViewContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'

  // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      socket.off("upload_response");
      socket.off("file_view");
      socket.off("view_file_response");
      socket.off("delete_file_response");
      socket.off("download_response");
    };
  }, [socket]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000); // Adjust the duration as needed (3000 ms = 3 seconds)

      return () => clearTimeout(timer); // Cleanup timeout on unmount or when message changes
    }
  }, [message]);

  const showLoading = (message = "Loading...") => {
    Swal.fire({
      title: message,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  };

  const closeLoading = (message = "successful") => {
    Swal.fire({
      icon: "success",
      title: message,
      timer: 1500, // Display for 1.5 seconds
      showConfirmButton: false,
    });
  };
  const closeLoadingfail = (message = "successful") => {
    Swal.fire({
      icon: "fail",
      title: message,
      timer: 1500, // Display for 1.5 seconds
      showConfirmButton: false,
    });
  };
  // Handle file upload
  // Handle file upload
  const handleFileUpload = () => {
    if (!selectedFile) {
      setMessageType("error");
      setMessage("Please select a file to upload.");
      Swal.fire("Error", "Please select a file to upload.", "error");
      return;
    }
    showLoading("Uploading file...");
    const reader = new FileReader();
    reader.onload = () => {
      const fileContent = reader.result;
      socket.emit("upload_file", {
        username,
        filename: selectedFile.name,
        size: selectedFile.size,
      });

      // Emit the file data in chunks
      const chunkSize = 1024 * 512; // 0.5MB
      let offset = 0;

      // Read the file in chunks and emit each chunk
      const sendChunk = () => {
        if (offset < fileContent.byteLength) {
          const chunk = fileContent.slice(offset, offset + chunkSize);
          socket.emit("file_data", chunk);
          offset += chunkSize;
          setTimeout(sendChunk, 100); // Small delay to avoid overwhelming the server
        } else {
          // closeLoading("File upload complete.");
          console.log("File upload complete.");
        }
      };

      socket.off("ack_upload").on("ack_upload", (data) => {
        if (data.status === "ACK") {
          sendChunk();
        } // Start sending chunks
      });
    };
    reader.readAsArrayBuffer(selectedFile);
    socket.off("file_upload").on("file_upload", (data) => {
      console.log("Received upload file response:", data); // Log the response
      if (data.status == "FAIL") {
        setMessageType("error");
        closeLoadingfail("File not uploaded.");
        setMessage(data.error);
      } else if (data.status == "EXISTS") {
        setMessageType("error");
        closeLoadingfail("File already exists.");
        setMessage(data.error);
      } else {
        closeLoading("File uploaded successfully.");
        setMessageType("success");
        setMessage(data.message);
      }
    });

    socket.off("ack_upload_completed").on("ack_upload_completed", (data) => {
      if (data.status === "ACK") {
        closeLoading("File upload complete.");
        socket.emit("list_files", { username });
      } // Start sending chunks
    });
  };

  // List all files
  const handleListFiles = () => {
    showLoading("Fetching file list...");
    socket.emit("list_files", { username });

    socket.off("file_list").on("file_list", (data) => {
      console.log("Received file list data:", data); // Log the received data
      closeLoading();
      if (data.error) {
        setMessageType("error");
        setMessage(data.error);
      } else {
        setFileList(data.files);
        setMessageType("Files retrieved successfully.");
        setMessage("Files retrieved successfully.");
      }
    });
  };

  // View file content
  const handleViewFile = () => {
    if (!fileName) {
      setMessageType("error");
      setMessage("Please enter a file name to view.");
      return;
    }
    showLoading("Loading file preview...");
    socket.emit("view_file", { username, filename: fileName });

    socket.off("file_view").on("file_view", (data) => {
      console.log("Received file view data:", data); // Log the received data
      if (data.status === "Error") {
        setMessageType("error");
        closeLoadingfail("File not found.");
        setMessage(data.message);
      } else if (data.status === "ErrorView") {
        setMessageType("error");
        closeLoadingfail("File cannot be viewed.");
        setMessage(data.message);
      } else {
        setViewContent(data.data);
        setMessageType("success");
        closeLoading("File preview retrieved successfully.");
        setMessage("File preview retrieved successfully.");
      }
    });
  };
  // Download file
  const handleDownloadFile = () => {
    if (!fileName) {
      setMessageType("error");
      setMessage("Please enter a file name to download.");
      return;
    }
    showLoading("Downloading file...");
    socket.emit("download_file", { username, filename: fileName });

    socket.off("file_download_size").on("file_download_size", (response) => {
      console.log("Received file download size response:", response);
      if (response.size === 0) {
        setMessageType("error");
        closeLoadingfail("File not found.");
        setMessage("File not found.");
        return;
      }

      let receivedBytes = 0;
      const fileData = [];

      socket.off("file_data").on("file_data", (data) => {
        console.log("Received file data chunk:", data);
        // Convert the binary string to an ArrayBuffer
        const byteArray = new Uint8Array(data.data);
        fileData.push(byteArray);
        receivedBytes += byteArray.length;

        if (receivedBytes === response.size) {
          // Create a single Blob from all chunks
          const blob = new Blob(fileData);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          closeLoading("File downloaded successfully.");
          setMessageType("success");
          setMessage("File downloaded successfully.");
        }
      });
    });
  };

  // Delete file
  const handleDeleteFile = () => {
    if (!fileName) {
      setMessageType("error");
      setMessage("Please enter a file name to delete.");
      return;
    }
    showLoading("Deleting file...");
    socket.emit("delete_file", { username, filename: fileName });

    socket.off("file_delete").on("file_delete", (data) => {
      console.log("Received delete file response:", data); // Log the response
      if (data.status == "FAIL") {
        setMessageType("error");
        closeLoadingfail("File not found.");
        setMessage(data.error);
      } else {
        closeLoading("File deleted successfully.");
        setMessageType("success");
        setMessage(data.message);
      }
    });
  };

  const handleLogout = () => {
    socket.disconnect();
    window.location.href = "/"; // Redirect to login page
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white">
      <h1 className="text-4xl font-semibold mb-10 mt-6">
        Welcome, {username}!
      </h1>

      <div className="bg-black bg-opacity-70 p-8 rounded-lg shadow-2xl backdrop-blur-lg w-full max-w-4xl">
        <div className="space-y-8">
          {/* File Upload Section */}
          <div>
            <h2 className="text-2xl font-medium mb-4">Upload Files</h2>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="block w-full p-3 bg-transparent border-2 border-white text-white rounded-md placeholder-gray-300 focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile}
              className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-md text-white font-semibold hover:from-purple-500 hover:to-indigo-500 focus:outline-none"
            >
              {selectedFile ? "Upload" : "Select a file first"}
            </button>
          </div>

          {/* File Operations Section */}
          <div>
            <h2 className="text-2xl font-medium mb-4">File Operations</h2>
            <input
              type="text"
              placeholder="Enter file name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="block w-full p-3 mb-4 bg-transparent border-2 border-white text-white rounded-md placeholder-gray-300 focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex space-x-4">
              <button
                onClick={handleDownloadFile}
                disabled={!fileName}
                className="py-3 px-6 bg-gradient-to-r from-green-600 to-teal-600 rounded-md text-white font-semibold hover:from-green-500 hover:to-teal-500"
              >
                Download
              </button>
              <button
                onClick={handleViewFile}
                disabled={!fileName}
                className="py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-md text-white font-semibold hover:from-blue-500 hover:to-cyan-500"
              >
                View
              </button>
              <button
                onClick={handleDeleteFile}
                disabled={!fileName}
                className="py-3 px-6 bg-gradient-to-r from-red-600 to-orange-600 rounded-md text-white font-semibold hover:from-red-500 hover:to-orange-500"
              >
                Delete
              </button>
            </div>
          </div>
          <div className="">
            {" "}
            <hr />
          </div>

          {/* List Files Section */}
          <div className="">
            <button
              onClick={handleListFiles}
              className="py-3 px-6 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-md text-white font-semibold hover:from-yellow-500 hover:to-amber-500"
            >
              List Files
            </button>
          </div>

          {/* File List and Preview */}
          <div className="mt-6 w-full">
            {fileList.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-300">
                  Available Files:
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {fileList.map((file, index) => (
                    <div
                      key={index}
                      className="text-lg bg-gray-800 border border-neutral-500 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-700 hover:scale-105 transition-transform duration-200 shadow-md"
                      title={file}
                    >
                      {file.length > 20 ? `${file.substring(0, 20)}...` : file}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {viewContent && (
              <div className="mt-10 w-full">
                <h3 className="text-2xl font-bold mb-4 text-gray-300">
                  File Preview:
                </h3>
                <div className="bg-gray-900 text-gray-100 p-6 rounded-lg shadow-md overflow-auto max-h-96 border border-gray-700">
                  <pre className="whitespace-pre-wrap break-words">
                    {viewContent}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Message Section */}
          {message && (
            <div
              className={`mt-6 p-4 rounded-md text-center text-lg ${
                messageType === "error" ? "bg-red-600" : "bg-green-600"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Logout button */}
      <div className="absolute top-6 right-6 flex space-x-4">
        <button
          className="py-3 px-6 bg-white rounded-md text-black font-semibold flex items-center space-x-2 hover:bg-gray-200"
          onClick={handleLogout}
        >
          <FaUserCircle className="text-xl" /> {/* Profile icon */}
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default MainWindow;
