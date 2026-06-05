import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../src/App';
import muiTheme from '../../src/theme';
import { ProgressProvider } from '../../src/context/ProgressContext';

describe('app routes smoke', () => {
  it('renders home title', async () => {
    render(
      <ThemeProvider theme={muiTheme}>
        <ProgressProvider>
          <MemoryRouter initialEntries={['/']}>
            <AppRoutes />
          </MemoryRouter>
        </ProgressProvider>
      </ThemeProvider>
    );

    expect(await screen.findByText(/Life-Safety Laboratories/i)).toBeInTheDocument();
  });
});
