import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage        from '../pages/LandingPage';
import ProtectedRoute     from '../components/auth/ProtectedRoute';
import LoginPage          from '../pages/LoginPage';
import SignupPage         from '../pages/SignupPage';
import OTPVerificationPage from '../pages/OTPVerificationPage';
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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/"                    element={<LandingPage />} />
      <Route path="/login"               element={<LoginPage />} />
      <Route path="/signup"              element={<SignupPage />} />
      <Route path="/verify-otp"          element={<OTPVerificationPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"           element={<DashboardPage />} />
        <Route path="/sessions"            element={<SessionsPage />} />
        <Route path="/session/:id"         element={<SessionDetails />} />
        <Route path="/profile"             element={<ProfilePage />} />

        {/* Module 1 — Question Paper Generation */}
        <Route path="/module1/exam-details" element={<ExamDetails />} />
        <Route path="/module1/upload"       element={<UploadPDF />} />
        <Route path="/module1/topics"       element={<TopicReview />} />
        <Route path="/module1/generate"     element={<QuestionGeneration />} />
        <Route path="/module1/review"       element={<QuestionReview />} />
        <Route path="/module1/blueprint"    element={<BlueprintConfig />} />

        {/* Module 2 — Answer Sheet Evaluation */}
        <Route path="/module2/upload"    element={<UploadAnswerSheet />} />
        <Route path="/module2/ocr"       element={<OCRReview />} />
        <Route path="/module2/mapping"   element={<AnswerMapping />} />
        <Route path="/module2/evaluate"  element={<EvaluationPage />} />
        <Route path="/module2/report"    element={<FinalReport />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
