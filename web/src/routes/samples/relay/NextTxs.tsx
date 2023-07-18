import { FunctionComponent, useCallback, useEffect, useState } from "react";
import "./Relay.css";
import { CircularProgress, Button, Card, Typography, Tooltip } from '@mui/material';
import { getNextTxs } from "../../../logic/sample";
import { SafeInfo } from '@safe-global/safe-apps-sdk';
import { SafeMultisigTransaction } from "../../../logic/services";

enum Status {
    Loading,
    Error,
    Ready
}

interface NextTx {
    tx: SafeMultisigTransaction,
    ready: boolean
}

const NextTxItem: FunctionComponent<{ next: NextTx, handleRelay: (tx: SafeMultisigTransaction) => void }> = ({ next, handleRelay }) => {
    return (<Card className="NextTxCard">
        <Tooltip title={next.tx.safeTxHash}><span>{next.tx.safeTxHash.slice(0, 6)}...{next.tx.safeTxHash.slice(-6)}</span></Tooltip>
        {next.ready && <Button onClick={() => handleRelay(next.tx)}>Relay</Button>}
        {!next.ready && <Typography variant="body1">Requires Confirmation</Typography>}
    </Card>)
}

export const NextTxsList: FunctionComponent<{ safeInfo: SafeInfo, handleRelay: (tx: SafeMultisigTransaction) => void }> = ({ safeInfo, handleRelay }) => {
    const [ status, setStatus ] = useState<Status>(Status.Loading)
    const [ nextTxs, setNextTxs ] = useState<NextTx[]>([])
    const fetchData = useCallback(async () => {
        try {
            setStatus(Status.Loading)
            const txs = await getNextTxs(safeInfo.safeAddress)
            setNextTxs(txs.map((tx) => {
                return {
                    tx,
                    ready: (tx.confirmations?.length ?? 0) >= safeInfo.threshold
                }
            }))
            setStatus(Status.Ready)
        } catch (e) {
            console.error(e)
            setStatus(Status.Error)
        }
    }, [setStatus, safeInfo])
    useEffect(() => {
        fetchData();
    }, [fetchData])
    
    switch(status) {
        case Status.Loading:
            return (<Card className="Notice">
                <CircularProgress />
            </Card>)
        case Status.Error:
            return (<Card className="Notice">
                <Typography variant="body1">
                    Error Loading Data
                </Typography>
            </Card>)
        case Status.Ready:
            if (nextTxs.length == 0) return (<Card className="Notice">
                <Typography variant="body1">
                    No pending transactions
                </Typography>
            </Card>)
            return (<>
                <Button onClick={fetchData}>Reload</Button>
                {nextTxs.map((nextTx) => <NextTxItem next={nextTx} handleRelay={handleRelay} />)}
            </>)
    }
};
