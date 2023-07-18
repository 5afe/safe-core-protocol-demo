import { FunctionComponent, useCallback, useEffect, useState } from "react";
import WarningIcon from '@mui/icons-material/Warning';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import * as blockies from 'blockies-ts';
import "./Plugins.css";
import { PluginMetadata } from "../../logic/metadata";
import { PluginDetails, disablePlugin, enablePlugin, loadPluginDetails } from "../../logic/plugins";
import { openSafeApp } from "../../logic/safeapp";
import { Button, Card, Tooltip } from '@mui/material';

type PluginMetaProps = {
    metadata: PluginMetadata;
  };

const PluginMeta: FunctionComponent<PluginMetaProps> = ({ metadata }) => {
    return (
        <>
            {metadata.name} - {metadata.version}
        </>
    );
};

type PluginProps = {
  address: string;
};

export const Plugin: FunctionComponent<PluginProps> = ({ address }) => {
    const [details, setDetails] = useState<PluginDetails|undefined>(undefined);
    const blocky = blockies.create({ seed: address }).toDataURL();
    useEffect(() => {
        const fetchData = async() => {
            try {
                setDetails(await loadPluginDetails(address))
            } catch(e) {
                console.warn(e)
            }
        }
        fetchData();
    }, [address])

    const handleToggle = useCallback(async () => {
        if (details?.enabled === undefined) return
        try {
            if (details.enabled)
                await disablePlugin(address)
            else 
                await enablePlugin(address, details.metadata.requiresRootAccess)
        } catch (e) {
            console.warn(e)
        }
    }, [details])
    return (
        <Card className="Plugin">
            <Tooltip title={address}><img className="AddressIcon" src={blocky} /></Tooltip>
            <div className="Plugin-title">{!details ? "Loading Metadata" : <PluginMeta metadata={details.metadata} />}</div>
            {details?.metadata?.requiresRootAccess == true && <WarningIcon color="warning" />}
            {details?.enabled != undefined && <Button className="Plugin-toggle" onClick={handleToggle}>{details?.enabled ? "Disable" : "Enable"}</Button>}
            {(details?.metadata?.appUrl?.length ?? 0) > 0 && <OpenInNewIcon className="Plugin-link" onClick={() => openSafeApp(details?.metadata?.appUrl!!)} />}
        </Card>
    );
};
