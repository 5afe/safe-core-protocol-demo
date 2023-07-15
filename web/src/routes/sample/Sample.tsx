import { FunctionComponent, useCallback, useEffect, useState } from "react";
import { formatUnits, parseUnits } from "ethers"
import { useParams } from "react-router-dom";
import "./Sample.css";
import { CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, Button, Typography } from '@mui/material';
import { TokenInfo, getAvailableFeeToken, getMaxFeePerToken, getStatus, getTokenInfo, isKnownSamplePlugin, relayTx, updateMaxFeePerToken } from "../../logic/sample";
import { getSafeInfo, isConnectedToSafe } from "../../logic/safeapp";

export const Sample: FunctionComponent<{}> = () => {
    const { pluginAddress } = useParams();
    const [ newMaxFee, setNewMaxFee ] = useState<string>("");
    const [ dataToRelay, setDataToRelay ] = useState<string>("");
    const [ taskId, setTaskId ] = useState<string>("");
    const [ account, setAccount ] = useState<string|undefined>(undefined)
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
                setAccount(info.safeAddress)
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
        if (account === undefined || selectedFeeToken === undefined) return
        const fetchData = async() => {
            try {
                const maxFee = await getMaxFeePerToken(account, selectedFeeToken)
                setMaxFee(maxFee)
            } catch (e) {
                console.error(e)
            }
        }
        fetchData();
    }, [selectedFeeToken, account])
    const updateMaxFee = useCallback(async (feeTokenInfo: TokenInfo, maxFeeInput: string) => {
        console.log("UPDATE")
        const targetMaxFee = parseUnits(maxFeeInput, feeTokenInfo.decimals)
        await updateMaxFeePerToken(feeTokenInfo.address, targetMaxFee)
    }, [])

    const isLoading = account === undefined || maxFee === undefined || selectedFeeTokenInfo === undefined
    
    return (
        <div className="Sample">
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
            {account !== undefined && maxFee !== undefined && selectedFeeTokenInfo !== undefined && <>
                <p>Current max fee set: {formatUnits(maxFee, selectedFeeTokenInfo.decimals)} {selectedFeeTokenInfo.symbol}</p>
                <Typography variant="body1">
                    New max fee ({selectedFeeTokenInfo.symbol}):<br />
                    <TextField id="standard-basic" label={`Max Fee (${selectedFeeTokenInfo.symbol})`} variant="standard" value={newMaxFee} onChange={(event) => setNewMaxFee(event.target.value)}/>
                </Typography>
                <Button onClick={() => updateMaxFee(selectedFeeTokenInfo, newMaxFee)}>Update</Button>
                <TextField id="standard-basic" label={`Data to relay`} variant="standard" value={dataToRelay} onChange={(event) => setDataToRelay(event.target.value)}/>
                <Button onClick={async() => { setTaskId(await relayTx(account, dataToRelay, selectedFeeTokenInfo.address))} }>Relay</Button>
                <TextField id="standard-basic" label={`Task id`} variant="standard" value={taskId} onChange={(event) => setTaskId(event.target.value)}/>
                <Button onClick={() => getStatus(taskId)}>Get Status</Button>
            </>}
        </div>
    );
};
