import { FunctionComponent, useEffect, useState } from "react";
import WarningIcon from '@mui/icons-material/Warning';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import * as blockies from 'blockies-ts';
import "./Plugins.css";
import { PluginMetadata } from "../../logic/metadata";
import { loadPluginDetails } from "../../logic/plugins";

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
    const [metadata, setMetadata] = useState<PluginMetadata|undefined>(undefined);
    const blocky = blockies.create({ seed: address }).toDataURL();
    useEffect(() => {
        const fetchData = async() => {
            try {
                setMetadata(await loadPluginDetails(address))
            } catch(e) {
                console.warn(e)
            }
        }
        fetchData();
    }, [address])
    return (
        <div className="Plugin">
            <img className="AddressIcon" src={blocky} />
            <div className="Plugin-title">{!metadata ? "Loading Metadata" : <PluginMeta metadata={metadata} />}</div>
            {metadata?.requiresRootAccess == true && <WarningIcon color="warning" />}
            {(metadata?.appUrl?.length ?? 0) > 0 && <a href={metadata?.appUrl} target="_blank"><OpenInNewIcon /></a>}
        </div>
    );
};
