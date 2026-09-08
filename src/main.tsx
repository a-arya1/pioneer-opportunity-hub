import React from 'react';import ReactDOM from 'react-dom/client';import {BrowserRouter,HashRouter} from 'react-router-dom';import App from './App';import './styles.css';import {AuthProvider} from './contexts/AuthContext';import {AnalyticsProvider} from './contexts/AnalyticsContext';
const Router=import.meta.env.BASE_URL==='/'?BrowserRouter:HashRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><AnalyticsProvider><Router><App/></Router></AnalyticsProvider></AuthProvider></React.StrictMode>);
