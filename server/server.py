import os
import subprocess
import socketio
import eventlet
import eventlet.tpool

# Initialize a Socket.IO server instance
sio = socketio.Server(cors_allowed_origins="*")  # Allow all origins for now
app = socketio.WSGIApp(sio)

uploaded_files = {}  # This will store the uploaded file data by session ID

def run_command(command):
    """Run a shell command asynchronously using a thread pool."""
    print(f"Executing command: {command}")
    try:
        result = eventlet.tpool.execute(subprocess.run, command, shell=True, capture_output=True, text=True)
    except Exception as e:
        print(f"Error executing command: {e}")
        return None  # Return None or handle the error appropriately

    # Attempt to decode the output
    try:
        stdout = result.stdout.encode('utf-8').decode('utf-8', errors='replace')  # Replace undecodable bytes
        stderr = result.stderr.encode('utf-8').decode('utf-8', errors='replace')
        result.stdout = stdout
        result.stderr = stderr
    except Exception as e:
        print(f"Error decoding output: {e}")
        result.stdout = "Error decoding output."
        result.stderr = str(e)

    return result


def ensure_hdfs_directory_exists(hdfs_directory):
    """Ensure that a directory exists in HDFS."""
    print(f"Checking if HDFS directory {hdfs_directory} exists...")
    command = f"hadoop fs -test -d {hdfs_directory}"
    result = run_command(command)
    if result.returncode != 0:  # Directory doesn't exist
        print(f"Directory {hdfs_directory} does not exist, creating it...")
        mkdir_command = f"hadoop fs -mkdir -p {hdfs_directory}"
        mkdir_result = subprocess.run(mkdir_command, shell=True, capture_output=True, text=True)
        if mkdir_result.returncode == 0:
            print(f"Directory {hdfs_directory} created successfully in HDFS.")
        else:
            print(f"Failed to create directory {hdfs_directory} in HDFS: {mkdir_result.stderr}")
    else:
        print(f"Directory {hdfs_directory} already exists.")

def authenticate_user(username, password):
    """Authenticate the user based on credentials."""
    print(f"Attempting to authenticate user: {username}")
    with open("users.txt", "r") as f:
        for line in f:
            correct_username, correct_password = line.strip().split(" ")
            if username == correct_username and password == correct_password:
                print(f"User  {username} authenticated successfully.")
                return True
    print(f"Authentication failed for user: {username}")
    return False

def upload_to_hdfs(local_path, hdfs_path,sid):
    """Uploads a local file to HDFS."""
    print(f"Uploading file from {local_path} to HDFS path {hdfs_path}...")
    hdfs_directory = os.path.dirname(hdfs_path)
    #ensure_hdfs_directory_exists(hdfs_directory)
    command = f"hadoop fs -put {local_path} {hdfs_path}"
    result = run_command(command)
    print(result)
    if result.returncode == 0:
        print(f"File {local_path} uploaded to HDFS at {hdfs_path}.")
        sio.emit('file_upload', {'status': 'SUCCESS'}, room=sid)
    elif result.returncode == 1:
        print(f"File {local_path} already exists in HDFS at {hdfs_path}.")
        sio.emit('file_upload', {'status': 'EXISTS'}, room=sid)
    else:
        print(f"Failed to upload {local_path} to HDFS: {result.stderr}")
        sio.emit('file_upload', {'status': 'FAIL'}, room=sid)

def download_from_hdfs(hdfs_path, local_path):
    """Downloads a file from HDFS to a local path."""
    print(f"Downloading file from HDFS path {hdfs_path} to local path {local_path}...")
    command = f"hadoop fs -get {hdfs_path} {local_path}"
    result = run_command(command)
    if result.returncode == 0:
        print(f"File {hdfs_path} downloaded from HDFS to {local_path}.")
    else:
        print(f"Failed to download {hdfs_path} from HDFS: {result.stderr}")

def delete_from_hdfs(hdfs_path,sid):
    """Deletes a file in HDFS."""
    print(f"Deleting file {hdfs_path} from HDFS...")
    command = f"hadoop fs -rm {hdfs_path}"
    result = run_command(command)
    if result.returncode == 0:
        print(f"File {hdfs_path} deleted from HDFS.")
        sio.emit('file_delete', {'status': 'SUCCESS'}, room=sid)

    else:
        print(f"Failed to delete {hdfs_path} from HDFS: {result.stderr}")
        sio.emit('file_delete', {'status': 'FAIL'}, room=sid)


# Define events for Socket.IO
@sio.event
def connect(sid, environ):
    print(f"Client {sid} connected.")

@sio.event
def authenticate(sid, data):
    """Authenticate the user based on credentials."""
    print(f"Received authentication request from client {sid}.")
    username = data['username']
    password = data['password']
    
    if authenticate_user(username, password):
        print(f"Authentication successful for {username}.")
        sio.emit('auth_response', {'status': 'SUCCESS', 'username': username}, room=sid)
    else:
        print(f"Authentication failed for {username}.")
        sio.emit('auth_response', {'status': 'FAIL'}, room=sid)

@sio.event
def list_files(sid, data):
    """Lists files for a given user ."""
    print(f"Client {sid} requested file list.")
    username = data['username']
    hdfs_path = f"/server_storage/{username}/"
    print(f"Listing files in HDFS path: {hdfs_path}")
    command = f"hadoop fs -ls {hdfs_path} | awk '{{print $8}}' | xargs -n 1 basename"
    result = run_command(command)
    if result.returncode == 0:
        print(f"File list for {username}: {result.stdout.splitlines()}")
        sio.emit('file_list', {'files': result.stdout.splitlines()}, room=sid)
    else:
        print(f"Failed to list files for {username}: {result.stderr}")
        sio.emit('file_list', {'files': []}, room=sid)

@sio.event
def view_file(sid, data):
    """View a specific file."""
    print(f"Client {sid} requested to view file.")
    username = data['username']
    filename = data['filename']
    hdfs_path = f"/server_storage/{username}/{filename}"

    print(f"File {filename} exists, attempting to view.")
    command = f"hadoop fs -cat {hdfs_path} | head -c 1024"
    result = run_command(command)
    
    if result is None:
        print(f"Failed to execute command for viewing file.")
        sio.emit('file_view', {'status': 'ErrorView', 'message': 'Failed to execute command.'}, room=sid)
        return

    if result.stdout:
        print(f"File content preview: {result.stdout[:100]}...")  # Preview first 100 chars
        sio.emit('file_view', {'status': 'SUCCESS', 'data': result.stdout}, room=sid)
    else:
        print(f"Unable to view the file or file is empty.")
        sio.emit('file_view', {'status': 'Error', 'message': 'Unable to view the file or file is empty.'}, room=sid)

        
@sio.event
def download_file(sid, data):
    """Download file from HDFS."""
    print(f"Client {sid} requested to download file.")
    username = data['username']
    filename = data['filename']
    hdfs_path = f"/server_storage/{username}/{filename}"
    local_path = f"{username}_d_{filename}"

    download_from_hdfs(hdfs_path, local_path)

    if os.path.isfile(local_path):
        file_size = os.path.getsize(local_path)
        print(f"File {filename} size: {file_size} bytes.")
        sio.emit('file_download_size', {'size': file_size}, room=sid)

        with open(local_path, 'rb') as f:
            while True:
                bytes_read = f.read(1024)
                if not bytes_read:
                    break
                # Send the data as an ArrayBuffer
                sio.emit('file_data', {'data': bytes_read}, room=sid)

        os.remove(local_path)
        print(f"{filename} sent successfully to {sid}.")
    else:
        print(f"File {filename} not found locally after download.")
        sio.emit('file_download_size', {'size': 0}, room=sid)

        
@sio.event
def upload_file(sid, data):
    """Upload a file to HDFS."""
    print(f"Client {sid} requested to upload file.")
    username = data['username']
    filename = data['filename']
    file_size = data['size']
    
    local_path = f"{username}_u_{filename}"
    sio.emit('ack_upload', {'status': 'ACK'}, room=sid)

    # Store the necessary information in uploaded_files
    uploaded_files[sid] = {
        'local_path': local_path,
        'bytes_received': 0,
        'file_size': file_size,
        'username': username,  # Store the username here
        'filename': filename    # Store the filename here
    }

    
@sio.event
def file_data(sid, chunk):
    """Receive file data chunks."""
    if sid in uploaded_files:
        with open(uploaded_files[sid]['local_path'], 'ab') as f:
            f.write(chunk)
            uploaded_files[sid]['bytes_received'] += len(chunk)
            print(f"Received {uploaded_files[sid]['bytes_received']}/{uploaded_files[sid]['file_size']} bytes...")

        if uploaded_files[sid]['bytes_received'] >= uploaded_files[sid]['file_size']:
            print(f"File upload complete for {uploaded_files[sid]['local_path']}.")
            hdfs_path = f"/server_storage/{uploaded_files[sid]['username']}/{uploaded_files[sid]['filename']}"
            upload_to_hdfs(uploaded_files[sid]['local_path'], hdfs_path,sid)
            os.remove(uploaded_files[sid]['local_path'])
            del uploaded_files[sid]  # Clean up after processing
    else:
        print(f"No upload in progress for client {sid}.")

@sio.event
def delete_file(sid, data):
    """Delete a file from HDFS."""
    print(f"Client {sid} requested to delete file.")
    username = data['username']
    filename = data['filename']
    hdfs_path = f"/server_storage/{username}/{filename}"
    delete_from_hdfs(hdfs_path,sid)
    # sio.emit('file_delete', {'status': 'SUCCESS'}, room=sid)


@sio.event
def disconnect(sid):
    print(f"Client {sid} disconnected.")

# Start the server
if __name__ == "__main__":
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 65432)), app)
    print("Server started on port 65432")
