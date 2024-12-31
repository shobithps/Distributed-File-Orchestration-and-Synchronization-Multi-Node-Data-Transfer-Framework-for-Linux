import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import "../index.css";
const LoginPage = () => {
    const socket = useSocket();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();




    
    const handleLoginSubmit = (e) => {
        e.preventDefault();
    
        // Clear previous message
        setMessage("");
        setLoading(true);
    
        // Emit the authenticate event
        socket.emit("authenticate", { username, password });
    
        // Listen for the response
        socket.off("auth_response").on("auth_response", (data) => {
            setLoading(false);
            if (data.status === "SUCCESS") {
                setMessage("Login successful!");
                navigate(`/main/${username}`);  // Redirect to the main page
            } else {
                setMessage("Authentication failed. Please check your credentials.");
            }
        });
    };
    

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black">
            <div className="bg-black bg-opacity-60 p-10 rounded-lg shadow-lg backdrop-blur-md w-full max-w-md">
                <h2 className="text-3xl text-white text-center font-semibold mb-6">Login</h2>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-white">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
                            className="w-full p-3 rounded-md bg-transparent border-2 border-white text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-white">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="w-full p-3 rounded-md bg-transparent border-2 border-white text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-md text-white font-semibold hover:from-purple-500 hover:to-indigo-500 focus:outline-none"
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                {message && (
                    <p className={`mt-4 text-center text-white ${loading ? "opacity-50" : ""}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
