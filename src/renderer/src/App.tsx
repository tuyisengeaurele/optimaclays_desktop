import type { JSX } from 'react/jsx-runtime'

export default function App(): JSX.Element {
  const { node, chrome, electron } = window.api.versions

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Optima Clays Desktop</h1>
      <p>Electron shell is running.</p>
      <ul>
        <li>Node {node}</li>
        <li>Chrome {chrome}</li>
        <li>Electron {electron}</li>
      </ul>
    </div>
  )
}
