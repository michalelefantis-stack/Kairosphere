
import React, { useState, useRef, useEffect } from 'react';
import { AgentOrchestrator } from '../utils/agentSystem';
import { AgentLog, LiveRitual, RawIntercept } from '../types';
import { Terminal, Globe, ShieldCheck, Map as MapIcon, Cpu, Search, ArrowRight, Loader2, Wifi, Radio } from 'lucide-react';

interface SignalIntelligenceProps {
  onEventFound: (event: LiveRitual) => void;
}

const SignalIntelligence: React.FC<SignalIntelligenceProps> = ({ onEventFound }) => {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStage, setCurrentStage] = useState<number>(0); // 0: Idle, 1: Scout, 2: Polyglot, 3: Fact, 4: Architect
  const [locationInput, setLocationInput] = useState<string>('');
  const orchestrator = useRef(new AgentOrchestrator());
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (agent: AgentLog['agent'], message: string, status: AgentLog['status'] = 'processing', data?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      agent,
      message,
      timestamp: Date.now(),
      status,
      data
    }]);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const startScan = async () => {
    setIsScanning(true);
    setLogs([]); // Clear previous
    setCurrentStage(1);

    try {
      // 1. THE SCOUT
      addLog('SCOUT', 'Initializing Firecrawl/BrowserUse module...', 'processing');
      await new Promise(r => setTimeout(r, 800)); // UI delay
      
      if (locationInput.trim()) {
        addLog('SCOUT', `Scanning frequencies specifically for: ${locationInput}...`, 'processing');
      } else {
        addLog('SCOUT', 'Scanning global local frequencies: Reddit, Pantip, Twitter...', 'processing');
      }
      
      const intercept = await orchestrator.current.runScout(locationInput.trim() || undefined);
      addLog('SCOUT', `Intercepted high-intensity signal from ${intercept.source} [${intercept.language}]`, 'success', intercept);
      
      setCurrentStage(2);

      // 2. THE POLYGLOT
      addLog('POLYGLOT', 'Engaging LLM linguistic processor...', 'processing');
      const polyglotData = await orchestrator.current.runPolyglot(intercept);
      addLog('POLYGLOT', `Decoded: "${polyglotData.eventName}" in ${polyglotData.location}`, 'success', polyglotData);

      setCurrentStage(3);

      // 3. THE FACT-CHECKER
      addLog('FACT_CHECKER', 'Cross-referencing with global news outlets via Google Search...', 'processing');
      const verification = await orchestrator.current.runFactChecker(polyglotData);
      
      if (!verification.verified) {
         addLog('FACT_CHECKER', 'Verification failed. Rumor flagged as unsubstantiated.', 'failed');
         setIsScanning(false);
         setCurrentStage(0);
         return;
      }
      addLog('FACT_CHECKER', `Confirmed. Confidence: ${(verification.confidence * 100)}%. Sources: ${verification.sourceUrls.length}`, 'success', verification);

      setCurrentStage(4);

      // 4. THE ARCHITECT
      addLog('ARCHITECT', 'Calculating geospatial impact radius...', 'processing');
      const ritual = await orchestrator.current.runArchitect(polyglotData, verification);
      addLog('ARCHITECT', `Live object constructed. Pushing to global grid.`, 'success', ritual);
      
      onEventFound(ritual);

    } catch (e) {
      console.error(e);
      addLog('SCOUT', 'System Error: Agent chain broken.', 'failed');
    } finally {
      setIsScanning(false);
      setCurrentStage(5); // Done
    }
  };

  const getAgentStatusColor = (stage: number, myStage: number) => {
    if (stage === myStage) return 'text-accent border-accent bg-accent/10 animate-pulse';
    if (stage > myStage) return 'text-accent border-accent opacity-50'; // Done
    return 'text-ink-faint border-line-soft'; // Waiting
  };

  return (
    <div className="w-full h-full bg-base p-8 flex flex-col font-mono text-sm relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-20" />

      {/* Header */}
      <header className="flex justify-between items-end mb-10 relative z-10 border-b border-line pb-6">
        <div>
          <h1 className="text-3xl font-black text-ink uppercase tracking-tighter flex items-center gap-3">
             <Radio className="w-8 h-8 text-accent animate-pulse" />
             Signal Intelligence
          </h1>
          <p className="text-accent text-xs uppercase tracking-[0.12em] mt-2">Multi-Agent Autonomous Reconnaissance</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <MapIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input 
              type="text"
              placeholder="Target Location (Optional)"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isScanning && startScan()}
              disabled={isScanning}
              className="bg-raised border border-line-hard text-ink text-xs uppercase tracking-widest pl-10 pr-4 py-3 outline-none focus:border-accent transition-colors w-64 disabled:opacity-50"
            />
          </div>
          <button 
            onClick={startScan}
            disabled={isScanning}
            className={`px-8 py-3 font-bold uppercase tracking-widest transition-all clip-path-polygon ${
              isScanning 
              ? 'bg-hover text-ink-faint cursor-not-allowed' 
              : 'bg-accent text-on-accent hover:bg-white hover:shadow-[0_0_30px_var(--k-glow-strong)]'
            }`}
          >
            {isScanning ? 'Agents Active...' : 'Initiate Scan'}
          </button>
        </div>
      </header>

      {/* Agents Status Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8 relative z-10">
        {[
          { id: 1, name: 'The Scout', role: 'Crawler', icon: Search },
          { id: 2, name: 'The Polyglot', role: 'Translator', icon: Globe },
          { id: 3, name: 'Fact-Checker', role: 'Verifier', icon: ShieldCheck },
          { id: 4, name: 'The Architect', role: 'Mapper', icon: MapIcon },
        ].map((agent) => (
          <div 
            key={agent.id}
            className={`border p-4 flex items-center gap-4 transition-all duration-500 ${getAgentStatusColor(currentStage, agent.id)}`}
          >
            <agent.icon className="w-6 h-6" />
            <div>
              <h3 className="font-bold uppercase leading-none">{agent.name}</h3>
              <p className="text-[12px] uppercase opacity-70 mt-1">{agent.role}</p>
            </div>
            {currentStage === agent.id && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
          </div>
        ))}
      </div>

      {/* Terminal Output */}
      <div className="flex-1 bg-base border border-line p-6 overflow-y-auto custom-scrollbar relative z-10 shadow-inner">
        {logs.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
             <Cpu className="w-16 h-16 mb-4" />
             <p className="uppercase tracking-widest text-xs">System Idle. Awaiting Command.</p>
           </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-start gap-4">
                  <span className="text-[12px] text-ink-faint pt-1">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`text-[12px] font-bold uppercase pt-1 min-w-[100px] ${
                    log.agent === 'SCOUT' ? 'text-blue-400' :
                    log.agent === 'POLYGLOT' ? 'text-purple-400' :
                    log.agent === 'FACT_CHECKER' ? 'text-orange-400' :
                    'text-accent'
                  }`}>
                    [{log.agent}]
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm ${
                      log.status === 'failed' ? 'text-red-500' : 
                      log.status === 'success' ? 'text-ink' : 'text-ink-dim'
                    }`}>
                      {log.message}
                    </p>
                    {log.data && (
                      <div className="mt-2 bg-raised p-3 border-l-2 border-line text-xs text-ink-dim font-mono whitespace-pre-wrap">
                        {JSON.stringify(log.data, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
      
      <div className="mt-2 flex justify-between text-[12px] text-ink-faint font-mono uppercase">
         <span>Secure Connection: TLS 1.3</span>
         <span>Latency: 24ms</span>
         <span className="flex items-center gap-2"><Wifi className="w-3 h-3" /> Online</span>
      </div>
    </div>
  );
};

export default SignalIntelligence;
