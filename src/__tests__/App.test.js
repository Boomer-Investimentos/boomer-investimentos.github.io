import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import App from '../App';

test('renders the home page', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  const matches = screen.getAllByText(/Boomer Investimentos/i);
  expect(matches.length).toBeGreaterThan(0);
});
