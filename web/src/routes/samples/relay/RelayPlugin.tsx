import { FunctionComponent, useCallback, useEffect, useState } from "react";
import { formatUnits, parseUnits } from "ethers"
import { useParams } from "react-router-dom";
import "./Relay.css";
import { CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, Button, Typography, Card } from '@mui/material';
import { TokenInfo, getAvailableFeeToken, getMaxFeePerToken, getTokenInfo, isKnownSamplePlugin, updateMaxFeePerToken } from "../../../logic/sample";
import { getSafeInfo, isConnectedToSafe } from "../../../logic/safeapp";
import { SafeInfo } from '@safe-global/safe-apps-sdk';
import { NextTxsList } from "./NextTxs";
import { SafeMultisigTransaction } from "../../../logic/services";
import { RelayDialog } from "./RelayDialog";

export const RelayPlugin: FunctionComponent<{}> = () => {
    const { pluginAddress } = useParams();
    const [ newMaxFee, setNewMaxFee ] = useState<string>("");
    const [ txToRelay, setTxToRelay ] = useState<SafeMultisigTransaction|undefined>(undefined);
    const [ safeInfo, setSafeInfo ] = useState<SafeInfo|undefined>(undefined)
    const [ feeTokens, setFeeTokens ] = useState<string[]>([])
    const [ maxFee, setMaxFee ] = useState<bigint | undefined>(undefined)
    const [ selectedFeeToken, setSelectedFeeToken ] = useState<string|undefined>(undefined)
    const [ selectedFeeTokenInfo, setSelectedFeeTokenInfo ] = useState<TokenInfo | undefined >(undefined)
    console.log({pluginAddress})
    useEffect(() => {
        const fetchData = async() => {
            try {
                if (!await isConnectedToSafe()) throw Error("Not connected to Safe")
                const info = await getSafeInfo()
                if (!isKnownSamplePlugin(info.chainId, pluginAddress!!)) throw Error("Unknown Plugin")
                setSafeInfo(info)
            } catch (e) {
                console.error(e)
            }
        }
        fetchData();
    }, [pluginAddress])
    useEffect(() => {
        const fetchData = async() => {
            try {
                const availableFeeTokens = await getAvailableFeeToken()
                setFeeTokens(availableFeeTokens)
                if (availableFeeTokens.length > 0) {
                    setSelectedFeeToken(availableFeeTokens[0])
                }
            } catch (e) {
                console.error(e)
            }
        }
        fetchData();
    }, [pluginAddress])
    useEffect(() => {
        if (selectedFeeToken === undefined) return
        const fetchData = async() => {
            try {
                setSelectedFeeTokenInfo(undefined)
                const tokenInfo = await getTokenInfo(selectedFeeToken)
                console.log({tokenInfo})
                setSelectedFeeTokenInfo(tokenInfo)
            } catch (e) {
                console.error(e)
            }
        }
        fetchData();
    }, [selectedFeeToken])
    useEffect(() => {
        setMaxFee(undefined)
        if (safeInfo === undefined || selectedFeeToken === undefined) return
        const fetchData = async() => {
            try {
                const maxFee = await getMaxFeePerToken(safeInfo.safeAddress, selectedFeeToken)
                setMaxFee(maxFee)
            } catch (e) {
                console.error(e)
            }
        }
        fetchData();
    }, [selectedFeeToken, safeInfo])
    const updateMaxFee = useCallback(async (feeTokenInfo: TokenInfo, maxFeeInput: string) => {
        console.log("UPDATE")
        const targetMaxFee = parseUnits(maxFeeInput, feeTokenInfo.decimals)
        await updateMaxFeePerToken(feeTokenInfo.address, targetMaxFee)
    }, [])

    const isLoading = safeInfo === undefined || maxFee === undefined || selectedFeeTokenInfo === undefined
    
    return (
        <div className="Sample">
            <Card className="Settings">
                {isLoading && <CircularProgress />}
                {feeTokens.length > 0 && selectedFeeToken !== undefined && <>
                    <FormControl fullWidth>
                        <InputLabel id="demo-simple-select-label">Fee Token</InputLabel>
                        <Select
                            labelId="demo-simple-select-label"
                            id="demo-simple-select"
                            value={selectedFeeToken}
                            label="Fee Token"
                            color="primary"
                            onChange={(selected) => setSelectedFeeToken(selected.target.value)}
                        >
                            {feeTokens.map((token) => <MenuItem value={token}>{token}</MenuItem>)}
                        </Select>
                    </FormControl>
                </>}
                {safeInfo !== undefined && maxFee !== undefined && selectedFeeTokenInfo !== undefined && <>
                    <p>Current max fee set: {formatUnits(maxFee, selectedFeeTokenInfo.decimals)} {selectedFeeTokenInfo.symbol}</p>
                    <Typography variant="body1">
                        New max fee ({selectedFeeTokenInfo.symbol}):<br />
                        <TextField id="standard-basic" label={`Max Fee (${selectedFeeTokenInfo.symbol})`} variant="standard" value={newMaxFee} onChange={(event) => setNewMaxFee(event.target.value)}/>
                    </Typography>
                    <Button onClick={() => updateMaxFee(selectedFeeTokenInfo, newMaxFee)}>Update</Button>
                </>}   
                </Card>
            {safeInfo && <NextTxsList safeInfo={safeInfo} handleRelay={(tx) => setTxToRelay(tx)}/>}
            <RelayDialog tx={txToRelay} feeToken={selectedFeeToken} handleClose={() => setTxToRelay(undefined)} />
        </div>
    );
};
