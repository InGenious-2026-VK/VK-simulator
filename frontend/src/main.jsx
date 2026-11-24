import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth/AuthContext.jsx';
import HomePage from './pages/HomePage.jsx';
import DataLakePage from './pages/DataLakePage.jsx';
import VisualizationPage from './pages/VisualizationPage.jsx';
import SimulationPage from './pages/SimulationPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import './index.css';
import './App.css';
import './pages/pages.css';
import './pages/site/site.css';

// The four FoodChainIQ windows (documentation/foodchainiq-application-windows.md).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route
            path="/datalake"
            element={
              <RequireAuth>
                <DataLakePage />
              </RequireAuth>
            }
          />
          <Route
            path="/visualize"
            element={
              <RequireAuth>
                <VisualizationPage />
              </RequireAuth>
            }
          />
          <Route
            path="/simulate"
            element={
              <RequireAuth>
                <SimulationPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
