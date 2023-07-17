import { FunctionComponent, useEffect, useState } from "react";
import "./Relay.css";
import { CircularProgress, Button, Typography } from '@mui/material';
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

export const NextTxItem: FunctionComponent<{ next: NextTx, handleRelay: (tx: SafeMultisigTransaction) => void }> = ({ next, handleRelay }) => {
    return (<div className="NextTx">
        {next.tx.safeTxHash}
        {next.ready && <Button onClick={() => handleRelay(next.tx)}>Relay</Button>}
    </div>)
}

export const NextTxsList: FunctionComponent<{ safeInfo: SafeInfo, handleRelay: (tx: SafeMultisigTransaction) => void }> = ({ safeInfo, handleRelay }) => {
    const [ status, setStatus ] = useState<Status>(Status.Loading)
    const [ nextTxs, setNextTxs ] = useState<NextTx[]>([])
    useEffect(() => {
        setStatus(Status.Loading)
        const fetchData = async() => {
            try {
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
        }
        fetchData();
    }, [setStatus, safeInfo])
    
    switch(status) {
        case Status.Loading:
            return (
                <CircularProgress />
            )
        case Status.Error:
            return (
                <Typography variant="body1">
                    Error Loading Data
                </Typography>
            )
        case Status.Ready:
            return (<>
                {nextTxs.map((nextTx) => <NextTxItem next={nextTx} handleRelay={handleRelay} />)}
            </>)
    }
};
