import './App.css';
import Analyze from './Components/Analyze';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Fabric from './Components/Fabric';
import FabricPipeline from './Components/FabricPipeline';
import NotebookMigrator from './Components/NotebookMigrator';
import FabricEnhanced from './Components/FabricEnhanced';
import OutputView from './Components/OutputView';
import OutputViewFabricEnhanced from './Components/OutputViewFabricEnhanced';
import RepoExplorer from './Components/RepoExplorer';
import Home from './Components/Home';
import ProtectedRoute from './Components/ProtectedRoute';
import IdleLogout from './Components/IdleLogout';

function App() {

  return (
    <div className="app">

      <BrowserRouter>
        <IdleLogout />
        <Routes >
          {/* Home page with version selection */}
          <Route path="/" element={<Home />} />

          {/* Version 1 routes */}
          <Route path="/v1" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
          <Route path="/v1/fabric" element={<ProtectedRoute><Fabric /></ProtectedRoute>} />
          <Route path="/v1/fabricdatapipeline" element={<ProtectedRoute><FabricPipeline /></ProtectedRoute>} />
          <Route path="/v1/fabricnotebook" element={<ProtectedRoute><NotebookMigrator /></ProtectedRoute>} />
          <Route path="/v1/lineageView" element={<ProtectedRoute><OutputView /></ProtectedRoute>} />

          {/* Version 2 routes */}
          <Route path="/v2" element={<ProtectedRoute><FabricEnhanced /></ProtectedRoute>} />
          <Route path="/v2/repoexplorer" element={<ProtectedRoute><RepoExplorer /></ProtectedRoute>} />
          <Route path="/v2/fabricenhancedlineage" element={<ProtectedRoute><OutputViewFabricEnhanced /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      </div>
  );
}

export default App;
