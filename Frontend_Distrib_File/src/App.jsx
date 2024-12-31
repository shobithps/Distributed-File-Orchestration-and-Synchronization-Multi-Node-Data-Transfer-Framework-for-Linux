import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MainWindow from "./pages/MainWindow";
import { SocketProvider } from "./contexts/SocketContext";

function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/main/:username" element={<MainWindow />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;
