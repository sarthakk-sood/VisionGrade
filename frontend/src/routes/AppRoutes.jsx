import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage          from '../pages/LoginPage';
import DashboardPage      from '../pages/DashboardPage';
import SessionsPage       from '../pages/SessionsPage';
import SessionDetails     from '../pages/SessionDetails';
import ProfilePage        from '../pages/ProfilePage';
import ExamDetails        from '../pages/Module1/ExamDetails';
import UploadPDF          from '../pages/Module1/UploadPDF';
import TopicReview        from '../pages/Module1/TopicReview';
import QuestionGeneration from '../pages/Module1/QuestionGeneration';
import QuestionReview     from '../pages/Module1/QuestionReview';
import BlueprintConfig    from '../pages/Module1/BlueprintConfig';
import UploadAnswerSheet  from '../pages/Module2/UploadAnswerSheet';
import OCRReview          from '../pages/Module2/OCRReview';
import AnswerMapping      from '../pages/Module2/AnswerMapping';
import EvaluationPage     from '../pages/Module2/EvaluationPage';
import FinalReport        from '../pages/Module2/FinalReport';

/** Only renders for unauthenticated users — redirects to dashboard if already logged in. */
function PublicOnlyRoute({ element }) {
  return localStorage.getItem('vg_token')
    ? <Navigate to="/dashboard" replace />
    : element;
}

/** Only renders for authenticated users — redirects to login if no token.
 *  The backend 401 interceptor in api.js also clears stale tokens and hard-redirects. */
function ProtectedRoute({ element }) {
  return localStorage.getItem('vg_token')
    ? element
    : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root — always goes to login (or dashboard if already in) */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Auth — only visible when NOT logged in */}
      <Route path="/login" element={<PublicOnlyRoute element={<LoginPage />} />} />

      {/* Protected app routes */}
      <Route path="/dashboard"   element={<ProtectedRoute element={<DashboardPage />} />} />
      <Route path="/sessions"    element={<ProtectedRoute element={<SessionsPage />} />} />
      <Route path="/session/:id" element={<ProtectedRoute element={<SessionDetails />} />} />
      <Route path="/profile"     element={<ProtectedRoute element={<ProfilePage />} />} />

      {/* Module 1 — Question Paper Generation */}
      <Route path="/module1/exam-details" element={<ProtectedRoute element={<ExamDetails />} />} />
      <Route path="/module1/upload"       element={<ProtectedRoute element={<UploadPDF />} />} />
      <Route path="/module1/topics"       element={<ProtectedRoute element={<TopicReview />} />} />
      <Route path="/module1/generate"     element={<ProtectedRoute element={<QuestionGeneration />} />} />
      <Route path="/module1/review"       element={<ProtectedRoute element={<QuestionReview />} />} />
      <Route path="/module1/blueprint"    element={<ProtectedRoute element={<BlueprintConfig />} />} />

      {/* Module 2 — Answer Sheet Evaluation */}
      <Route path="/module2/upload"   element={<ProtectedRoute element={<UploadAnswerSheet />} />} />
      <Route path="/module2/ocr"      element={<ProtectedRoute element={<OCRReview />} />} />
      <Route path="/module2/mapping"  element={<ProtectedRoute element={<AnswerMapping />} />} />
      <Route path="/module2/evaluate" element={<ProtectedRoute element={<EvaluationPage />} />} />
      <Route path="/module2/report"   element={<ProtectedRoute element={<FinalReport />} />} />

      {/* Catch-all — unknown routes go to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
