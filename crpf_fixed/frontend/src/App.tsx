import { BrowserRouter, Routes, Route } from "react-router-dom";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Report from "./pages/Report";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/review/:runId" element={<Review />} />
        <Route path="/report/:runId" element={<Report />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;