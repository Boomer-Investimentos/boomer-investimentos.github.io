import ReactDOM from 'react-dom/client';
import App from './App';
import { HashRouter } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HashRouter>
    <App />
  </HashRouter>
);
