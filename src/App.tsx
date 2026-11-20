import { Sparkles, Code2 } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { LeftSidebar } from './components/LeftSidebar';
import { MapViewport } from './components/MapViewport';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { AiSettingsModal } from './components/AiSettingsModal';
import { useStudioStore } from './store/useStudioStore';

export function App() {
  const rightTab = useStudioStore((s) => s.rightTab);
  const setRightTab = useStudioStore((s) => s.setRightTab);

  return (
    <div className="studio-root">
      <HeaderBar />
      <main className="studio-workspace">
        <LeftSidebar />
        <section className="studio-center">
          <MapViewport />
        </section>
        <aside className="right-sidebar">
          <div className="right-tabs">
            <button
              id="tab-ai-assistant"
              className={`right-tab-btn ${rightTab === 'ai' ? 'active' : ''}`}
              onClick={() => setRightTab('ai')}
            >
              <Sparkles size={14} /> AI 副驾驶
            </button>
            <button
              id="tab-inspector"
              className={`right-tab-btn ${rightTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setRightTab('inspector')}
            >
              <Code2 size={14} /> 属性 & Lua
            </button>
          </div>
          <div className="right-tab-body">
            {rightTab === 'ai' ? <AiAssistantPanel /> : <InspectorPanel />}
          </div>
        </aside>
      </main>
      <AiSettingsModal />
    </div>
  );
}

export default App;
