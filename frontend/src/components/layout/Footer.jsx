import { motion } from 'framer-motion';
import { Mail, Phone, Twitter, Linkedin, Github } from 'lucide-react';

const links = ['Home', 'Features', 'Pricing', 'FAQ', 'Contact'];

export default function Footer() {
  return (
    <motion.footer
      className="border-t border-slate-200 bg-white"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr,1fr,1fr] lg:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-600">VisionGrade</p>
          <h3 className="mt-3 text-3xl font-bold text-slate-900">A professional AI evaluation stack for faculty-led workflows.</h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
            Build question papers, review OCR output, evaluate handwritten answer sheets, and export polished reports from one enterprise-ready interface.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">Links</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {links.map((link) => (
              <li key={link}>{link}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">Contact</h4>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-blue-600" /> support@visiongrade.ai</p>
            <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-blue-600" /> +91 98765 43210</p>
            <div className="flex items-center gap-3 pt-3 text-slate-500">
              <Twitter className="h-4 w-4" />
              <Linkedin className="h-4 w-4" />
              <Github className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
