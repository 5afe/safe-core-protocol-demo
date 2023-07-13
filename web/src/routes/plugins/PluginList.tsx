import { useEffect, useState } from 'react';
import logo from '../../logo.svg';
import './Plugins.css';
import { loadPlugins } from '../../logic/plugins';
import { Plugin } from './Plugin';

function PluginList() {
  const [plugins, setPlugins] = useState<string[]>([]);
  useEffect(() => {
      const fetchData = async() => {
        setPlugins(await loadPlugins())
      }
      fetchData();
  }, [])
  return (
    <div className="Plugins">
      <header className="Plugins-header">
        <img src={logo} className="Plugins-header-logo" alt="logo" />
        <p>
          Safe&#123;Core&#125; Protocol Demo
        </p>
      </header>
      <div className='Plugins-list'>
        {plugins.map((plugin) => <Plugin address={plugin} />)}
      </div>
    </div>
  );
}

export default PluginList;
