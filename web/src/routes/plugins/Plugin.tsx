import { FunctionComponent, useEffect, useState } from "react";
import * as blockies from 'blockies-ts';
import "./Plugins.css";
import { PluginMetaData } from "../../logic/metadata";
import { loadPluginMeta } from "../../logic/plugins";

type PluginMetaProps = {
    meta: PluginMetaData;
  };

const PluginMeta: FunctionComponent<PluginMetaProps> = ({ meta }) => {
    return (
        <>
            {meta.name} - {meta.version}
        </>
    );
};

type PluginProps = {
  address: string;
};

export const Plugin: FunctionComponent<PluginProps> = ({ address }) => {
    const [meta, setMeta] = useState<PluginMetaData|undefined>(undefined);
    const blocky = blockies.create({ seed: address }).toDataURL();
    useEffect(() => {
        const fetchData = async() => {
            setMeta(await loadPluginMeta(address))
        }
        fetchData();
    }, [address])
    return (
        <div className="Plugin">
            <img className="AddressIcon" src={blocky} /> {!meta ? "Loading Meta" : <PluginMeta meta={meta} />}
        </div>
    );
};
