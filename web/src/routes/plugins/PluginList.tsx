import { useCallback, useEffect, useState } from 'react';
import logo from '../../logo.svg';
import './Plugins.css';
import { loadPlugins } from '../../logic/plugins';
import { Plugin } from './Plugin';
import { Button, Checkbox, FormControlLabel } from '@mui/material';

function PluginList() {
  const [showFlagged, setFilterFlagged] = useState<boolean>(false);
  const [plugins, setPlugins] = useState<string[]>([]);
  const fetchData = useCallback(async () => {
    try {
      setPlugins([])
      setPlugins(await loadPlugins(!showFlagged))
    } catch(e) {
      console.warn(e)
    }
  }, [showFlagged])
  useEffect(() => {
      fetchData();
  }, [fetchData])
  return (
    <div className="Plugins">
      <header className="Plugins-header">
        <img src={logo} className="Plugins-header-logo" alt="logo" />
        <p>
          Safe&#123;Core&#125; Protocol Demo
        </p>
      </header>
      <span>
        <FormControlLabel control={
          <Checkbox checked={showFlagged} onChange={(_, checked) => setFilterFlagged(checked) } inputProps={{ 'aria-label': 'controlled' }} />
        } label="Show Flagged PlugIns" />
        <Button onClick={fetchData}>Reload</Button>
      </span>
      <div className='Plugins-list'>
        {plugins.map((plugin) => <Plugin address={plugin} />)}
      </div>
    </div>
  );
}

export default PluginList;
