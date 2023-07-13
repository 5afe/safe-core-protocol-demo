import { Link } from 'react-router-dom';
import logo from '../../logo.svg';
import './Home.css';

function Home() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Safe&#123;Core&#125; Protocol Demo
        </p>
        <Link to="/plugins">Show availabe Plugins</Link>
      </header>
    </div>
  );
}

export default Home;
