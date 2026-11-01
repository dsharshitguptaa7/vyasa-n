import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubjectsPage } from '../pages/atharva/SubjectsPage';
import { atharvaAdminService } from '../services/atharvaAdminService';
import { Subject, SubjectCluster } from '../types/atharva';

const mockClusters: SubjectCluster[] = [
  {
    id: 'cluster-1',
    cluster_number: 101,
    name: 'Computer Science & IT',
    description: 'Faculty of Computing',
    is_active: true,
    assistant_dean_id: 'dean-1',
    assistant_dean: null,
    subject_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cluster-2',
    cluster_number: 102,
    name: 'Physical & Mathematical Sciences',
    description: 'Faculty of Physical Sciences',
    is_active: true,
    assistant_dean_id: 'dean-2',
    assistant_dean: null,
    subject_count: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockSubjects: Subject[] = [
  {
    id: 'sub-1',
    name: 'Data Engineering',
    code: 'CS-DE-01',
    subject_cluster_id: 'cluster-1',
    cluster_name: 'Computer Science & IT',
    cluster_number: 101,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sub-2',
    name: 'Theoretical Physics',
    code: 'PHY-TH-02',
    subject_cluster_id: 'cluster-2',
    cluster_name: 'Physical & Mathematical Sciences',
    cluster_number: 102,
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('Super Admin Subject Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(atharvaAdminService, 'getSubjects').mockResolvedValue([...mockSubjects]);
    vi.spyOn(atharvaAdminService, 'getSubjectClusters').mockResolvedValue([...mockClusters]);
  });

  it('1. renders subject listing, metric cards, and table columns', async () => {
    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
      expect(screen.getByText('CS-DE-01')).toBeInTheDocument();
      expect(screen.getByText('Theoretical Physics')).toBeInTheDocument();
      expect(screen.getByText('PHY-TH-02')).toBeInTheDocument();
    });

    // Metric strip
    expect(screen.getByText('Total Subjects')).toBeInTheDocument();
    expect(screen.getByText('Active Subjects')).toBeInTheDocument();
    expect(screen.getByText('Mapped Clusters')).toBeInTheDocument();
  });

  it('2. adds a new subject with validation and updates table', async () => {
    const createSpy = vi.spyOn(atharvaAdminService, 'createSubject').mockResolvedValue({
      id: 'sub-new',
      name: 'Artificial Intelligence',
      code: 'AI-301',
      subject_cluster_id: 'cluster-1',
      cluster_name: 'Computer Science & IT',
      cluster_number: 101,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Open Add Modal
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Subject/i }));
    await waitFor(() => {
      expect(screen.getByText('Add New Academic Subject')).toBeInTheDocument();
    });

    // Try submitting without name -> validation error
    const addBtns = screen.getAllByRole('button', { name: /Add Subject/i });
    const modalAddBtn = addBtns[addBtns.length - 1];
    fireEvent.click(modalAddBtn);

    await waitFor(() => {
      expect(screen.getByText(/Subject Name is required/i)).toBeInTheDocument();
    });
    expect(createSpy).not.toHaveBeenCalled();

    // Fill in subject name and code
    const nameInput = screen.getByPlaceholderText(/e\.g\. Molecular Biology & Genetics/i);
    const codeInput = screen.getByPlaceholderText(/e\.g\. BIO-102/i);

    fireEvent.change(nameInput, { target: { value: 'Artificial Intelligence' } });
    fireEvent.change(codeInput, { target: { value: 'AI-301' } });

    // Submit form
    fireEvent.click(modalAddBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Artificial Intelligence',
        code: 'AI-301',
        subject_cluster_id: 'cluster-1',
        is_active: true,
      });
      expect(screen.getByText(/Subject 'Artificial Intelligence' created successfully/i)).toBeInTheDocument();
      expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
    });
  });

  it('3. edits an existing subject (name, code, cluster)', async () => {
    const updateSpy = vi.spyOn(atharvaAdminService, 'updateSubject').mockResolvedValue({
      id: 'sub-1',
      name: 'Advanced Data Engineering',
      code: 'CS-DE-99',
      subject_cluster_id: 'cluster-2',
      cluster_name: 'Physical & Mathematical Sciences',
      cluster_number: 102,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Click Edit on the first subject
    const editBtns = screen.getAllByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Edit Subject: Data Engineering/i)).toBeInTheDocument();
    });

    // Update form fields
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('sub-1', {
        name: 'Data Engineering',
        code: 'CS-DE-01',
        subject_cluster_id: 'cluster-1',
      });
      expect(screen.getByText(/Subject 'Advanced Data Engineering' updated successfully/i)).toBeInTheDocument();
    });
  });

  it('4. toggles subject active status (Activate / Deactivate)', async () => {
    const statusSpy = vi.spyOn(atharvaAdminService, 'updateSubjectStatus').mockResolvedValue({
      id: 'sub-1',
      is_active: false,
    });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Subject 1 is active, so button says "Deactivate"
    const deactivateBtn = screen.getByRole('button', { name: /^Deactivate$/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalledWith('sub-1', false);
      expect(screen.getByText(/Subject 'Data Engineering' active status set to Inactive/i)).toBeInTheDocument();
    });
  });

  it('5. re-maps a subject to another cluster', async () => {
    const remapSpy = vi.spyOn(atharvaAdminService, 'updateSubjectMapping').mockResolvedValue({
      id: 'sub-1',
      subject_cluster_id: 'cluster-2',
    });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Click Re-map
    const remapBtns = screen.getAllByRole('button', { name: /^Re-map$/i });
    fireEvent.click(remapBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Re-map Faculty Cluster: Data Engineering/i)).toBeInTheDocument();
    });

    // Save Mapping
    const saveMappingBtn = screen.getByRole('button', { name: /Save Mapping/i });
    fireEvent.click(saveMappingBtn);

    await waitFor(() => {
      expect(remapSpy).toHaveBeenCalledWith('sub-1', 'cluster-1');
      expect(screen.getByText(/Subject 'Data Engineering' re-mapped to cluster successfully/i)).toBeInTheDocument();
    });
  });

  it('6. deletes an unreferenced subject successfully', async () => {
    const deleteSpy = vi.spyOn(atharvaAdminService, 'deleteSubject').mockResolvedValue({ id: 'sub-1' });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Click Delete on first subject
    const deleteBtns = screen.getAllByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to permanently delete academic subject/i)).toBeInTheDocument();
    });

    // Confirm Delete
    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('sub-1');
      expect(screen.getByText(/Subject 'Data Engineering' permanently deleted/i)).toBeInTheDocument();
    });
  });

  it('7. handles deletion conflict and offers Deactivate Instead option', async () => {
    vi.spyOn(atharvaAdminService, 'deleteSubject').mockRejectedValue(
      new Error("Cannot delete subject 'Data Engineering': referenced by 4 scholar applicant profile(s). Deactivate instead to preserve historical records.")
    );
    const statusSpy = vi.spyOn(atharvaAdminService, 'updateSubjectStatus').mockResolvedValue({
      id: 'sub-1',
      is_active: false,
    });

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Data Engineering')).toBeInTheDocument();
    });

    // Click Delete
    const deleteBtns = screen.getAllByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();
    });

    // Attempt delete
    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    fireEvent.click(confirmBtn);

    // Conflict error is displayed
    await waitFor(() => {
      expect(screen.getByText(/referenced by 4 scholar applicant profile\(s\)/i)).toBeInTheDocument();
    });

    // Administrator clicks "Deactivate Subject Instead"
    const deactivateInsteadBtn = screen.getByRole('button', { name: /Deactivate Subject Instead/i });
    fireEvent.click(deactivateInsteadBtn);

    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalledWith('sub-1', false);
    });
  });
});
