import { Sidebar } from './components/Sidebar'
import { Workbench } from './components/Workbench'
import { RightPanel } from './components/RightPanel'
import { SettingsDialog } from './components/settings/SettingsDialog'

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <Workbench />
      </main>
      <RightPanel />
      <SettingsDialog />
    </div>
  )
}
