import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders IBP Analytics Platform', () => {
  render(<App />);
  const linkElement = screen.getByText(/IBP Analytics Platform/i);
  expect(linkElement).toBeInTheDocument();
});