import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RecognitionPhotoCarousel } from '../components/RecognitionPhotoCarousel';
import type { AnudaanGalleryItemOut, AnudaanGalleryImageOut } from '../types/anudaan';
import { anudaanService } from '../services/anudaanService';

describe('VYASA RecognitionPhotoCarousel — Section C Auto-Rotation & Controls Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createMockImages = (count: number): AnudaanGalleryImageOut[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `img-${i + 1}`,
      gallery_item_id: 'item-1',
      storage_key: `gallery/img-${i + 1}.jpg`,
      original_filename: `photo-${i + 1}.jpg`,
      mime_type: 'image/jpeg',
      file_size_bytes: 500000,
      caption: `Ceremony photograph ${i + 1}`,
      is_cover: i === 0,
      display_order: i,
      created_at: '2026-03-01T10:00:00Z',
    }));
  };

  const createMockItem = (imageCount: number, overrides?: Partial<AnudaanGalleryItemOut>): AnudaanGalleryItemOut => ({
    id: 'item-1',
    title: 'Excellence in Research Award',
    event_name: 'Annual Felicitation 2026',
    event_date: '2026-03-15',
    academic_year: '2025-2026',
    description: 'Honoring outstanding publications in Q1 Scopus journals.',
    researcher_name: 'Dr. Ramesh Sharma',
    researcher_designation: 'Associate Professor',
    department_name: 'Biotechnology',
    has_consent: true,
    is_featured: true,
    is_published: true,
    display_order: 1,
    images: createMockImages(imageCount),
    created_at: '2026-03-15T12:00:00Z',
    updated_at: '2026-03-15T12:00:00Z',
    ...overrides,
  });

  it('1. Entry with 5 photos automatically rotates every 5 seconds', () => {
    const item = createMockItem(5);
    render(<RecognitionPhotoCarousel item={item} />);

    // Starts at 1 / 5
    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    // After 5s -> advances to 2 / 5
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('2 / 5')).toBeInTheDocument();

    // After another 5s -> advances to 3 / 5
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('2. Entry with 2 photos loops continuously from last image back to first', () => {
    const item = createMockItem(2);
    render(<RecognitionPhotoCarousel item={item} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Advance 5s -> image 2
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // Advance 5s -> loops back to image 1
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Previous navigation from 1 loops to 2
    const prevBtn = screen.getByLabelText('Previous photograph');
    fireEvent.click(prevBtn);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // Next navigation from 2 loops to 1
    const nextBtn = screen.getByLabelText('Next photograph');
    fireEvent.click(nextBtn);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('3. Entry with 1 photo remains static (no autoplay, no arrows, no dots)', () => {
    const item = createMockItem(1);
    render(<RecognitionPhotoCarousel item={item} />);

    // Single image rendered
    expect(screen.getByAltText('Ceremony photograph 1')).toBeInTheDocument();

    // No navigation arrows or dots
    expect(screen.queryByLabelText('Previous photograph')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next photograph')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/1 \//i)).not.toBeInTheDocument();

    // Advancing timers does not change anything
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByAltText('Ceremony photograph 1')).toBeInTheDocument();
  });

  it('4. Entry with 0 photos displays the existing empty state', () => {
    const item = createMockItem(0);

    // Featured variant empty state
    const { rerender } = render(<RecognitionPhotoCarousel item={item} variant="featured" />);
    expect(screen.getByText('Official Ceremony Photograph')).toBeInTheDocument();
    expect(screen.queryByLabelText('Previous photograph')).not.toBeInTheDocument();

    // Standard variant empty state
    rerender(<RecognitionPhotoCarousel item={item} variant="standard" />);
    expect(screen.getByText('Ceremony Record')).toBeInTheDocument();
  });

  it('5. Navigation arrows work and reset the autoplay interval', () => {
    const item = createMockItem(5);
    render(<RecognitionPhotoCarousel item={item} />);

    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    // Advance 3 seconds (partway through interval)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    // User clicks Next arrow
    const nextBtn = screen.getByLabelText('Next photograph');
    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 5')).toBeInTheDocument();

    // Advance another 3 seconds (would have triggered 5s if not reset)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Should still be at 2 / 5 because interval was reset
    expect(screen.getByText('2 / 5')).toBeInTheDocument();

    // Advance remaining 2 seconds (total 5s after manual click) -> moves to 3 / 5
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('3 / 5')).toBeInTheDocument();

    // User clicks Previous arrow
    const prevBtn = screen.getByLabelText('Previous photograph');
    fireEvent.click(prevBtn);
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('6. Pagination dots navigate directly to the corresponding photo', () => {
    const item = createMockItem(4);
    render(<RecognitionPhotoCarousel item={item} />);

    expect(screen.getByText('1 / 4')).toBeInTheDocument();

    // Click dot 3
    const dot3 = screen.getByLabelText('Go to photograph 3 of 4');
    fireEvent.click(dot3);

    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(dot3).toHaveAttribute('aria-current', 'true');
  });

  it('7. Hover pauses autoplay and resumes when hover ends', () => {
    const item = createMockItem(3);
    render(<RecognitionPhotoCarousel item={item} />);

    const carousel = screen.getByRole('region');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Mouse enters -> pauses autoplay
    fireEvent.mouseEnter(carousel);

    act(() => {
      vi.advanceTimersByTime(10000); // 10s pass while hovering
    });
    // Still at 1 / 3
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Mouse leaves -> resumes autoplay
    fireEvent.mouseLeave(carousel);

    act(() => {
      vi.advanceTimersByTime(5000); // 5s after leave
    });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('8. Lightbox opens correctly when clicking image and preserves active index', () => {
    const item = createMockItem(4);
    const handleImageClick = vi.fn();
    render(<RecognitionPhotoCarousel item={item} onImageClick={handleImageClick} />);

    // Click Next to reach index 1 (2 / 4)
    const nextBtn = screen.getByLabelText('Next photograph');
    fireEvent.click(nextBtn);
    expect(handleImageClick).not.toHaveBeenCalled(); // Arrow click should not open lightbox!

    // Click Dot to reach index 2 (3 / 4)
    const dot3 = screen.getByLabelText('Go to photograph 3 of 4');
    fireEvent.click(dot3);
    expect(handleImageClick).not.toHaveBeenCalled(); // Dot click should not open lightbox!

    // Click on the image container
    const carousel = screen.getByRole('region');
    fireEvent.click(carousel);

    // Lightbox open callback triggered with the current active index (2)
    expect(handleImageClick).toHaveBeenCalledTimes(1);
    expect(handleImageClick).toHaveBeenCalledWith(2);
  });

  it('9. Mobile touch swipe navigates next/prev and prevents accidental lightbox open', () => {
    const item = createMockItem(4);
    const handleImageClick = vi.fn();
    render(<RecognitionPhotoCarousel item={item} onImageClick={handleImageClick} />);

    const carousel = screen.getByRole('region');
    expect(screen.getByText('1 / 4')).toBeInTheDocument();

    // Horizontal swipe left (deltaX = -60): Next
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 140, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 140, clientY: 100 }] });

    expect(screen.getByText('2 / 4')).toBeInTheDocument();

    // Accidental click following swipe does NOT open lightbox
    fireEvent.click(carousel);
    expect(handleImageClick).not.toHaveBeenCalled();

    // Horizontal swipe right (deltaX = +60): Prev
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 160, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 160, clientY: 100 }] });

    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('10. Multiple gallery entries maintain isolated, independent carousel states', () => {
    const itemA = createMockItem(3, { id: 'item-A', title: 'Award A' });
    const itemB = createMockItem(4, { id: 'item-B', title: 'Award B' });

    render(
      <div>
        <div data-testid="carousel-a">
          <RecognitionPhotoCarousel item={itemA} />
        </div>
        <div data-testid="carousel-b">
          <RecognitionPhotoCarousel item={itemB} />
        </div>
      </div>
    );

    const containerA = screen.getByTestId('carousel-a');
    const containerB = screen.getByTestId('carousel-b');

    expect(containerA).toHaveTextContent('1 / 3');
    expect(containerB).toHaveTextContent('1 / 4');

    // Click next only on carousel A
    const nextBtnA = containerA.querySelector('.anudaan-carousel__nav-btn--next')!;
    fireEvent.click(nextBtnA);

    expect(containerA).toHaveTextContent('2 / 3');
    // Carousel B is unaffected
    expect(containerB).toHaveTextContent('1 / 4');
  });

  it('11. Keyboard navigation (ArrowLeft, ArrowRight, Enter) works correctly', () => {
    const item = createMockItem(3);
    const handleImageClick = vi.fn();
    render(<RecognitionPhotoCarousel item={item} onImageClick={handleImageClick} />);

    const carousel = screen.getByRole('region');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // ArrowRight -> 2 / 3
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    // ArrowLeft -> 1 / 3
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Enter -> opens lightbox with active index
    fireEvent.keyDown(carousel, { key: 'Enter', target: carousel });
    expect(handleImageClick).toHaveBeenCalledWith(0);
  });

  it('12. Starts at cover photo if defined in item images', () => {
    const images = createMockImages(3);
    images[0].is_cover = false;
    images[2].is_cover = true; // 3rd image is cover

    const item = createMockItem(3, { images });
    render(<RecognitionPhotoCarousel item={item} />);

    // Starts directly at cover image (3 / 3)
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('13. Cleans up autoplay interval on unmount (no memory/timer leaks)', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const item = createMockItem(3);
    const { unmount } = render(<RecognitionPhotoCarousel item={item} />);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
