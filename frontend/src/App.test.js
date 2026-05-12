import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Plasma-bubbles IBP Analytics Platform', () => {
  test('renders the application shell without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });

  test('application loads with correct document structure', () => {
    render(<App />);
    const root = document.getElementById('root');
    expect(root).toBeInTheDocument();
  });
});