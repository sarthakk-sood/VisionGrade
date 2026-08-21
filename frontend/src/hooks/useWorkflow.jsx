/**
 * useWorkflow — enforces the Module 1 step-by-step progression.
 *
 * Steps (1-indexed):
 *   1 — Exam Details       → /module1/exam-details
 *   2 — Upload PDFs        → /module1/upload
 *   3 — Topics & Weightage → /module1/topics
 *   4 — Generate Questions → /module1/generate
 *   5 — Review Questions   → /module1/review
 *   6 — Export             → /module1/blueprint
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export const M1_ROUTES = [
  '/module1/exam-details', // step 1
  '/module1/upload',       // step 2
  '/module1/topics',       // step 3
  '/module1/generate',     // step 4
  '/module1/review',       // step 5
  '/module1/blueprint',    // step 6
];

/**
 * StepGuard — renders children only if the teacher has completed all prior steps.
 * Otherwise it immediately redirects to the first incomplete step.
 *
 * @param {number} step  1-indexed step number this page represents.
 */
export function StepGuard({ step, children }) {
  const navigate = useNavigate();
  const completedUpTo = useAppStore((s) => s.m1CompletedStep);

  useEffect(() => {
    // step 1 is always accessible
    if (step === 1) return;

    // For step N, the teacher must have completed step N-1
    if (completedUpTo < step - 1) {
      // Redirect to the furthest reachable step
      const redirectTo = M1_ROUTES[completedUpTo]; // completedUpTo is 0-based index when treated this way
      navigate(redirectTo, { replace: true });
    }
  }, [step, completedUpTo, navigate]);

  // If guard hasn't redirected, render the page
  if (step > 1 && completedUpTo < step - 1) return null;

  return children;
}
