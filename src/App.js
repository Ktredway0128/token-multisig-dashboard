import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';
import MultiSigWalletABI from './contracts/MultiSigWallet.json';
import TreasuryABI from './contracts/Treasury.json';
import localhostDeployment from './contracts/localhost.json';
import sepoliaDeployment from './contracts/sepolia.json';

const DEPLOYMENTS = {
  '0xaa36a7': sepoliaDeployment,
  '0x7a69':   localhostDeployment,
};

const MULTISIG_ABI = MultiSigWalletABI.abi;
const TREASURY_ABI = TreasuryABI.abi;

// ─── Color tokens ─────────────────────────────────────────────────────────────
const PURPLE     = '#7c3aed';
const LAVENDER   = '#c4b5fd';
const WHITE      = '#ffffff';
const MUTED      = '#a78bfa';
const GREEN      = '#22c55e';
const BLUE       = '#38bdf8';
const CARD_BG    = 'rgba(124, 58, 237, 0.08)';
const CARD_BDR   = 'rgba(196, 181, 253, 0.2)';

const STATUS_COLORS = {
  pending: { backgroundColor: 'rgba(124, 58, 237, 0.3)', color: WHITE },
  success: { backgroundColor: 'rgba(34, 197, 94, 0.25)', color: GREEN },
  error:   { backgroundColor: 'rgba(127, 29, 29, 0.4)', color: '#fca5a5' },
  default: { backgroundColor: 'rgba(196, 181, 253, 0.1)', color: LAVENDER },
};

const parseError = (err) => {
  if (err.message.includes('user rejected'))              return 'Transaction rejected in MetaMask.';
  if (err.message.includes('insufficient funds'))         return 'Insufficient funds for this transaction.';
  if (err.message.includes('Not an owner'))               return 'Connected wallet is not an owner of this multisig.';
  if (err.message.includes('Transaction does not exist')) return 'Transaction does not exist.';
  if (err.message.includes('Transaction already executed')) return 'This transaction has already been executed.';
  if (err.message.includes('Transaction already approved')) return 'You have already approved this transaction.';
  if (err.message.includes('Transaction not approved'))   return 'You have not approved this transaction.';
  if (err.message.includes('Not enough approvals'))       return 'Not enough approvals to execute this transaction.';
  if (err.message.includes('Invalid address'))            return 'Invalid destination address.';
  return 'Transaction failed. Please try again.';
};

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '16px', height: '16px',
      border: '2px solid rgba(196, 181, 253, 0.3)',
      borderTop: `2px solid ${LAVENDER}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '10px',
      verticalAlign: 'middle',
    }} />
  );
}

function App() {
  const [multiSigContract, setMultiSigContract] = useState(null);
  const [readMultiSig,     setReadMultiSig]     = useState(null);
  const [account,          setAccount]          = useState(null);
  const [chainId,          setChainId]          = useState(null);
  const [treasuryAddress,  setTreasuryAddress]  = useState('');

  // contract info
  const [owners,           setOwners]           = useState([]);
  const [required,         setRequired]         = useState(0);
  const [txCount,          setTxCount]          = useState(0);
  const [isOwner,          setIsOwner]          = useState(false);

  // transactions
  const [transactions,     setTransactions]     = useState([]);
  const [txFilter,         setTxFilter]         = useState('pending');

  // submit form
  const [toAddress,        setToAddress]        = useState('');
  const [txValue,          setTxValue]          = useState('');
  const [txData,           setTxData]           = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // treasury withdraw ETH form
  const [tWithdrawTo,      setTWithdrawTo]      = useState('');
  const [tWithdrawAmt,     setTWithdrawAmt]     = useState('');

  // treasury withdraw token form
  const [tTokenAddr,       setTTokenAddr]       = useState('');
  const [tTokenTo,         setTTokenTo]         = useState('');
  const [tTokenAmt,        setTTokenAmt]        = useState('');

  // status
  const [status,           setStatus]           = useState('');
  const [statusStyle,      setStatusStyle]      = useState(STATUS_COLORS.default);
  const [isLoading,        setIsLoading]        = useState(false);
  const [txHash,           setTxHash]           = useState('');



  // ── load data ───────────────────────────────────────────────────────────────

  const loadDashboardData = useCallback(async (_readMultiSig, _account) => {
    try {
      const _owners   = await _readMultiSig.getOwners();
      const _required = await _readMultiSig.required();
      const _txCount  = await _readMultiSig.transactionCount();
      const _isOwner  = await _readMultiSig.isOwner(_account);

      setOwners(_owners);
      setRequired(_required.toNumber());
      setTxCount(_txCount.toNumber());
      setIsOwner(_isOwner);

      const count = _txCount.toNumber();
      const txList = [];

      for (let i = 0; i < count; i++) {
        const tx = await _readMultiSig.getTransaction(i);
        const userApproved = await _readMultiSig.approved(i, _account);
        txList.push({
          index:         i,
          to:            tx.to,
          value:         ethers.utils.formatEther(tx.value),
          data:          tx.data,
          executed:      tx.executed,
          approvalCount: tx.approvalCount.toNumber(),
          userApproved,
        });
      }

      setTransactions(txList.reverse());
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, []);

  // ── connect wallet ──────────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setStatus('MetaMask not found. Please install it.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      const _chainId = await window.ethereum.request({ method: 'eth_chainId' });

      if (_chainId !== '0xaa36a7' && _chainId !== '0x7a69') {
        setStatus('Please switch MetaMask to Sepolia or Localhost 8545.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      const deployment       = DEPLOYMENTS[_chainId];
      const _multiSigAddress = deployment.MultiSigWallet.address;
      const _treasuryAddress = deployment.Treasury?.address || '';

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer   = provider.getSigner();
      const _account = await signer.getAddress();

      const isLocalhost = _chainId === '0x7a69';
      const rpc = isLocalhost
        ? new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545')
        : new ethers.providers.JsonRpcProvider(
            process.env.REACT_APP_ALCHEMY_URL,
            { name: 'sepolia', chainId: 11155111 }
          );

      const _multiSigContract = new ethers.Contract(_multiSigAddress, MULTISIG_ABI, signer);
      const _readMultiSig     = new ethers.Contract(_multiSigAddress, MULTISIG_ABI, rpc);

      setMultiSigContract(_multiSigContract);
      setReadMultiSig(_readMultiSig);
      setAccount(_account);
      setChainId(_chainId);
      setTreasuryAddress(_treasuryAddress);

      await loadDashboardData(_readMultiSig, _account);
    } catch (err) {
      setStatus('Error connecting wallet: ' + err.message);
      setStatusStyle(STATUS_COLORS.error);
    }
  }, [loadDashboardData]);

  // ── account change listener ─────────────────────────────────────────────────

  useEffect(() => {
    if (!window.ethereum) return;
    const handle = async (accounts) => {
      setStatus(''); setTxHash('');
      if (accounts.length === 0) {
        setAccount(null); setMultiSigContract(null); setReadMultiSig(null);
        setOwners([]); setRequired(0); setTxCount(0); setTransactions([]);
      } else {
        await connectWallet();
      }
    };
    window.ethereum.on('accountsChanged', handle);
    return () => window.ethereum.removeListener('accountsChanged', handle);
  }, [connectWallet]);

  // ── submit transaction ──────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!ethers.utils.isAddress(toAddress)) {
      setStatus('Please enter a valid destination address.'); setStatusStyle(STATUS_COLORS.error); return;
    }

    try {
      setStatus('Submitting transaction...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);

      const value = 0;
      const data  = txData || '0x';

      const tx = await multiSigContract.submitTransaction(toAddress, value, data);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));

      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Transaction submitted successfully!');
      setStatusStyle(STATUS_COLORS.success);
      setToAddress(''); setTxValue(''); setTxData('');
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── treasury withdraw ETH ───────────────────────────────────────────────────

  const handleTreasuryWithdrawETH = async () => {
    if (!ethers.utils.isAddress(tWithdrawTo)) {
      setStatus('Please enter a valid destination address.'); setStatusStyle(STATUS_COLORS.error); return;
    }
    if (!tWithdrawAmt || Number(tWithdrawAmt) <= 0) {
      setStatus('Please enter an amount greater than zero.'); setStatusStyle(STATUS_COLORS.error); return;
    }
    if (!treasuryAddress) {
      setStatus('Treasury address not found.'); setStatusStyle(STATUS_COLORS.error); return;
    }

    try {
      setStatus('Submitting treasury ETH withdrawal...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);

      const iface = new ethers.utils.Interface(TREASURY_ABI);
      const amount = ethers.utils.parseEther(tWithdrawAmt);
      const data = iface.encodeFunctionData('withdrawETH', [tWithdrawTo, amount]);

      const tx = await multiSigContract.submitTransaction(treasuryAddress, 0, data);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));

      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Treasury ETH withdrawal submitted! Awaiting approvals.');
      setStatusStyle(STATUS_COLORS.success);
      setTWithdrawTo(''); setTWithdrawAmt('');
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── treasury withdraw token ─────────────────────────────────────────────────

  const handleTreasuryWithdrawToken = async () => {
    if (!ethers.utils.isAddress(tTokenAddr)) {
      setStatus('Please enter a valid token address.'); setStatusStyle(STATUS_COLORS.error); return;
    }
    if (!ethers.utils.isAddress(tTokenTo)) {
      setStatus('Please enter a valid destination address.'); setStatusStyle(STATUS_COLORS.error); return;
    }
    if (!tTokenAmt || Number(tTokenAmt) <= 0) {
      setStatus('Please enter an amount greater than zero.'); setStatusStyle(STATUS_COLORS.error); return;
    }
    if (!treasuryAddress) {
      setStatus('Treasury address not found.'); setStatusStyle(STATUS_COLORS.error); return;
    }

    try {
      setStatus('Submitting treasury token withdrawal...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);

      const iface = new ethers.utils.Interface(TREASURY_ABI);
      const amount = ethers.utils.parseUnits(tTokenAmt, 18);
      const data = iface.encodeFunctionData('withdrawToken', [tTokenAddr, tTokenTo, amount]);

      const tx = await multiSigContract.submitTransaction(treasuryAddress, 0, data);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));

      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Treasury token withdrawal submitted! Awaiting approvals.');
      setStatusStyle(STATUS_COLORS.success);
      setTTokenAddr(''); setTTokenTo(''); setTTokenAmt('');
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── approve transaction ─────────────────────────────────────────────────────

  const handleApprove = async (txIndex) => {
    try {
      setStatus('Approving transaction...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);
      const tx = await multiSigContract.approveTransaction(txIndex);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Transaction approved!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── revoke approval ─────────────────────────────────────────────────────────

  const handleRevoke = async (txIndex) => {
    try {
      setStatus('Revoking approval...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);
      const tx = await multiSigContract.revokeApproval(txIndex);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Approval revoked.');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── execute transaction ─────────────────────────────────────────────────────

  const handleExecute = async (txIndex) => {
    try {
      setStatus('Executing transaction...'); setStatusStyle(STATUS_COLORS.pending); setIsLoading(true);
      const tx = await multiSigContract.executeTransaction(txIndex);
      await tx.wait();
      await new Promise(r => setTimeout(r, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Transaction executed successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readMultiSig, account);
    } catch (err) {
      setIsLoading(false); setTxHash('');
      setStatus(parseError(err)); setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ── refresh ─────────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    if (!readMultiSig || !account) return;
    setStatus('Refreshing...'); setStatusStyle(STATUS_COLORS.default);
    await loadDashboardData(readMultiSig, account);
    setStatus('');
  };

  const filteredTxs = transactions.filter(tx => {
    if (txFilter === 'pending')  return !tx.executed;
    if (txFilter === 'executed') return tx.executed;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="shimmer-bg"></div>
      <div className="content min-h-screen p-8">
        <div className="max-w-4xl mx-auto" style={{ position: 'relative' }}>

          {/* TD LOGO */}
          <img src="/td-logo-justtd.png" alt="Tredway Development"
            style={{ position: 'absolute', top: '0', left: '-110px', height: '35px' }} />

          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-5xl font-bold tracking-tight" style={{ color: WHITE }}>
                MultiSig <span style={{ color: LAVENDER }}>Wallet</span> Dashboard
              </h1>
              <p className="text-sm mt-2 uppercase tracking-widest font-medium" style={{ color: MUTED }}>
                Multi-Owner Transaction Control — Trustless Execution
              </p>
            </div>
            {account && (
              <div className="text-right">
                <button onClick={handleRefresh} disabled={isLoading}
                  className="text-xs font-mono px-3 py-1 rounded-lg mb-2 transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(196, 181, 253, 0.1)',
                    border: `1px solid ${CARD_BDR}`,
                    color: LAVENDER,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'block',
                    marginLeft: 'auto',
                  }}>
                  ↻ Refresh
                </button>
                <p className="text-xs font-mono" style={{ color: MUTED }}>Connected</p>
                <p className="text-sm font-mono font-semibold" style={{ color: LAVENDER }}>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </p>
                {isOwner && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: GREEN }}>✓ Owner</p>
                )}
              </div>
            )}
          </div>
          <hr style={{ borderColor: 'rgba(196, 181, 253, 0.15)', marginBottom: '2rem' }} />

          {/* STATUS BAR */}
          {status && (
            <div className="mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
              style={statusStyle}>
              {isLoading && <Spinner />}
              <span>{status}</span>
              {txHash && !isLoading && chainId === '0xaa36a7' && (
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: LAVENDER, textDecoration: 'underline', marginLeft: '8px', fontWeight: 'bold' }}>
                  View on Etherscan ↗
                </a>
              )}
            </div>
          )}

          {/* NOT CONNECTED */}
          {!account ? (
            <div className="text-center py-32">
              <div className="mb-6 text-6xl">🔐</div>
              <button onClick={connectWallet}
                className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90 mb-6 btn-hover"
                style={{ backgroundColor: PURPLE }}>
                Connect Wallet
              </button>
              <p className="text-3xl font-bold mb-3 tracking-tight" style={{ color: WHITE }}>
                Connect your wallet to manage the multisig
              </p>
              <p className="text-sm uppercase tracking-widest" style={{ color: MUTED }}>
                Make sure you're on the Sepolia test network or Localhost 8545
              </p>
            </div>
          ) : (
            <>
              {/* STAT CARDS */}
              <div className="grid grid-cols-4 gap-3 mb-8">
                {[
                  { label: 'Owners',            value: owners.length },
                  { label: 'Required',           value: `${required} of ${owners.length}` },
                  { label: 'Total Transactions', value: txCount },
                  { label: 'Network',            value: chainId === '0xaa36a7' ? 'Sepolia' : 'Localhost' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl p-4 shadow-sm card-hover"
                    style={{
                      backgroundColor: CARD_BG,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: `1px solid ${CARD_BDR}`,
                      borderLeft: `4px solid ${PURPLE}`,
                    }}>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>{stat.label}</p>
                    <p className="text-lg font-bold" style={{ color: WHITE }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* OWNERS CARD */}
              <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: CARD_BG,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${CARD_BDR}`,
                  borderLeft: `4px solid ${PURPLE}`,
                }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: WHITE }}>Owners</h2>
                {owners.map((owner, i) => (
                  <div key={owner} className="flex justify-between items-center py-2"
                    style={{ borderBottom: i < owners.length - 1 ? `1px solid ${CARD_BDR}` : 'none' }}>
                    <p className="text-sm font-mono" style={{ color: LAVENDER }}>
                      {owner.slice(0, 6)}...{owner.slice(-4)}
                      {owner.toLowerCase() === account.toLowerCase() && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${PURPLE}40`, color: LAVENDER }}>
                          you
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-mono" style={{ color: MUTED }}>{owner}</p>
                  </div>
                ))}
              </div>

              {/* TREASURY ACTIONS — owner only */}
              {isOwner && treasuryAddress && (
                <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                  style={{
                    backgroundColor: CARD_BG,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${CARD_BDR}`,
                    borderLeft: `4px solid ${BLUE}`,
                  }}>
                  <h2 className="text-lg font-bold mb-1" style={{ color: WHITE }}>Treasury Actions</h2>
                  <p className="text-xs mb-6" style={{ color: MUTED }}>
                    Submits a withdrawal transaction to the treasury. Requires {required} owner approval{required > 1 ? 's' : ''} before execution.
                  </p>

                  {/* Withdraw ETH */}
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BLUE }}>Withdraw ETH from Treasury</h3>

                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Destination Address</p>
                  <input type="text" placeholder="0x... destination address"
                    value={tWithdrawTo} onChange={(e) => setTWithdrawTo(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                    style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(56, 189, 248, 0.08)' }} />

                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Amount (ETH)</p>
                  <input type="number" placeholder="e.g. 0.5"
                    value={tWithdrawAmt} onChange={(e) => setTWithdrawAmt(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                    style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(56, 189, 248, 0.08)' }} />

                  <button onClick={handleTreasuryWithdrawETH} disabled={isLoading}
                    className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mb-8"
                    style={{
                      backgroundColor: BLUE,
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}>
                    ↑ Submit ETH Withdrawal
                  </button>

                  {/* Divider */}
                  <hr style={{ borderColor: CARD_BDR, marginBottom: '1.5rem' }} />

                  {/* Withdraw Token */}
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BLUE }}>Withdraw Token from Treasury</h3>

                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Token Address</p>
                  <input type="text" placeholder="0x... ERC-20 token address"
                    value={tTokenAddr} onChange={(e) => setTTokenAddr(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                    style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(56, 189, 248, 0.08)' }} />

                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Destination Address</p>
                  <input type="text" placeholder="0x... destination address"
                    value={tTokenTo} onChange={(e) => setTTokenTo(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                    style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(56, 189, 248, 0.08)' }} />

                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Amount</p>
                  <input type="number" placeholder="e.g. 1000"
                    value={tTokenAmt} onChange={(e) => setTTokenAmt(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                    style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(56, 189, 248, 0.08)' }} />

                  <button onClick={handleTreasuryWithdrawToken} disabled={isLoading}
                    className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                    style={{
                      backgroundColor: BLUE,
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}>
                    ↑ Submit Token Withdrawal
                  </button>
                </div>
              )}

              {/* SUBMIT TRANSACTION CARD — collapsible */}
              {isOwner && (
                <div className="rounded-2xl mb-8 shadow-sm"
                  style={{
                    backgroundColor: CARD_BG,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${CARD_BDR}`,
                    borderLeft: `4px solid ${PURPLE}`,
                  }}>
                  
                  {/* Header — always visible */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full p-6 flex justify-between items-center"
                    style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                    <div className="text-left">
                      <h2 className="text-lg font-bold" style={{ color: WHITE }}>Submit Transaction</h2>
                      <p className="text-xs mt-1" style={{ color: MUTED }}>For advanced use — call any contract function directly</p>
                    </div>
                    <span style={{ color: MUTED, fontSize: '1.2rem', transition: 'transform 0.2s', transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>

                  {/* Collapsible body */}
                  {showAdvanced && (
                    <div className="px-6 pb-6">
                      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Destination Address</p>
                      <input type="text" placeholder="0x... destination address"
                        value={toAddress} onChange={(e) => setToAddress(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-4"
                        style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(124, 58, 237, 0.1)' }} />

                      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>Call Data (optional)</p>
                      <input type="text" placeholder="0x — encoded function call for any contract interaction"
                        value={txData} onChange={(e) => setTxData(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 text-sm outline-none mb-6"
                        style={{ borderColor: CARD_BDR, color: WHITE, backgroundColor: 'rgba(124, 58, 237, 0.1)' }} />

                      <button onClick={handleSubmit} disabled={isLoading}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                        style={{
                          backgroundColor: PURPLE,
                          opacity: isLoading ? 0.6 : 1,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}>
                        ✦ Submit Transaction
                      </button>

                      <p className="text-xs mt-3" style={{ color: MUTED }}>
                      Use this for any contract interaction beyond treasury withdrawals. Requires {required} owner approvals before execution.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TRANSACTIONS CARD */}
              <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: CARD_BG,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${CARD_BDR}`,
                  borderLeft: `4px solid ${PURPLE}`,
                }}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold" style={{ color: WHITE }}>
                    Transactions
                    {transactions.length > 0 && (
                      <span style={{ color: MUTED, fontSize: '0.9rem', marginLeft: '8px' }}>
                        ({transactions.length})
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-2">
                    {['pending', 'executed', 'all'].map(f => (
                      <button key={f} onClick={() => setTxFilter(f)}
                        className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
                        style={{
                          backgroundColor: txFilter === f ? PURPLE : 'rgba(124, 58, 237, 0.1)',
                          color: txFilter === f ? WHITE : MUTED,
                          border: `1px solid ${CARD_BDR}`,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTxs.length === 0 ? (
                  <p className="text-sm" style={{ color: MUTED }}>
                    No {txFilter === 'all' ? '' : txFilter} transactions yet.
                  </p>
                ) : (
                  filteredTxs.map((tx) => (
                    <div key={tx.index} className="rounded-xl p-5 mb-4"
                      style={{
                        backgroundColor: tx.executed
                          ? 'rgba(34, 197, 94, 0.05)'
                          : 'rgba(124, 58, 237, 0.1)',
                        border: `1px solid ${tx.executed ? 'rgba(34, 197, 94, 0.2)' : CARD_BDR}`,
                      }}>

                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-bold" style={{ color: WHITE }}>
                            Transaction #{tx.index}
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-mono"
                              style={{
                                backgroundColor: tx.executed ? 'rgba(34, 197, 94, 0.2)' : `${PURPLE}40`,
                                color: tx.executed ? GREEN : LAVENDER,
                              }}>
                              {tx.executed ? 'Executed' : 'Pending'}
                            </span>
                          </p>
                          <p className="text-xs font-mono mt-1" style={{ color: MUTED }}>
                            To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold" style={{ color: WHITE }}>{tx.value} ETH</p>
                          <p className="text-xs" style={{ color: MUTED }}>
                            {tx.approvalCount} / {required} approvals
                          </p>
                        </div>
                      </div>

                      <div className="w-full rounded-full mb-4" style={{ height: '4px', backgroundColor: 'rgba(196, 181, 253, 0.15)' }}>
                        <div className="rounded-full" style={{
                          height: '4px',
                          width: `${Math.min((tx.approvalCount / required) * 100, 100)}%`,
                          backgroundColor: tx.approvalCount >= required ? GREEN : PURPLE,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>

                      {!tx.executed && isOwner && (
                        <div className="flex gap-2">
                          {!tx.userApproved ? (
                            <button
                              onClick={() => handleApprove(tx.index)}
                              disabled={isLoading}
                              className="flex-1 py-2 rounded-xl font-semibold text-white text-sm transition-all btn-hover"
                              style={{
                                backgroundColor: PURPLE,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                              }}>
                              ✓ Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevoke(tx.index)}
                              disabled={isLoading}
                              className="flex-1 py-2 rounded-xl font-semibold text-sm transition-all btn-hover"
                              style={{
                                backgroundColor: 'rgba(196, 181, 253, 0.1)',
                                border: `1px solid ${CARD_BDR}`,
                                color: MUTED,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                              }}>
                              ✕ Revoke
                            </button>
                          )}
                          {tx.approvalCount >= required && (
                            <button
                              onClick={() => handleExecute(tx.index)}
                              disabled={isLoading}
                              className="flex-1 py-2 rounded-xl font-semibold text-white text-sm transition-all btn-hover"
                              style={{
                                backgroundColor: GREEN,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                              }}>
                              ⚡ Execute
                            </button>
                          )}
                        </div>
                      )}

                      {tx.executed && (
                        <p className="text-xs font-semibold" style={{ color: GREEN }}>✓ Transaction executed</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;