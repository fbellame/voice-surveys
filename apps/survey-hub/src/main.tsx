import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Campaign } from '@shared/survey';

const App = () => <div>Survey Hub ready</div>;

createRoot(document.getElementById('root')!).render(<App/>);
