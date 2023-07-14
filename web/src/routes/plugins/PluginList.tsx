import { useEffect, useState } from 'react';
import logo from '../../logo.svg';
import './Plugins.css';
import { loadPlugins } from '../../logic/plugins';
import { Plugin } from './Plugin';
import { Checkbox, FormControlLabel } from '@mui/material';

function PluginList() {
  const [showFlagged, setFilterFlagged] = useState<boolean>(false);
  const [plugins, setPlugins] = useState<string[]>([]);
  useEffect(() => {
      const fetchData = async() => {
        try {
          setPlugins([])
          setPlugins(await loadPlugins(!showFlagged))
        } catch(e) {
          console.warn(e)
        }
      }
      fetchData();
  }, [showFlagged])
  return (
    <div className="Plugins">
      <header className="Plugins-header">
        <img src={logo} className="Plugins-header-logo" alt="logo" />
        <p>
          Safe&#123;Core&#125; Protocol Demo
        </p>
      </header>
      <FormControlLabel control={
        <Checkbox checked={showFlagged} onChange={(_, checked) => setFilterFlagged(checked) } inputProps={{ 'aria-label': 'controlled' }} />
      } label="Show Flagged PlugIns" />
      <div className='Plugins-list'>
        {plugins.map((plugin) => <Plugin address={plugin} />)}
      </div>
    </div>
  );
}

export default PluginList;
