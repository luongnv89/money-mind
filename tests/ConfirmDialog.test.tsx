import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog isOpen={false} title="Test" message="Msg" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.body.textContent).not.toContain('Test');
  });

  it('renders title and message when open', () => {
    render(<ConfirmDialog isOpen={true} title="Delete" message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog isOpen={true} title="Delete" message="Msg" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog isOpen={true} title="Delete" message="Msg" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders danger variant with red styling', () => {
    render(<ConfirmDialog isOpen={true} title="Danger" message="Msg" onConfirm={() => {}} onCancel={() => {}} variant="danger" />);
    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('danger');
  });

  it('renders custom confirm and cancel text', () => {
    render(<ConfirmDialog isOpen={true} title="Test" message="Msg" onConfirm={() => {}} onCancel={() => {}} confirmText="Delete" cancelText="Go Back" />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });
});
