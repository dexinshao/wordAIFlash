import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Study from "./pages/Study";
import WordList from "./pages/WordList";
import Import from "./pages/Import";
import Layout from "./components/Layout";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study/:libraryId" element={<Study />} />
        <Route path="/words/:libraryId" element={<WordList />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </Layout>
  );
}
