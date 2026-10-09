"use client";

import {
  ArrowRight,
  Books,
  Briefcase,
  CaretRight,
  CheckCircle,
  Check,
  Clock,
  House,
  Lock,
  Play,
  ShieldCheck,
  SignOut,
  Sparkle,
  SquaresFour,
  UploadSimple,
  Warning,
  Plus,
  Copy,
  PaperPlaneTilt,
  Eye,
  Terminal as TerminalGlyph,
  Robot,
} from "@phosphor-icons/react";
import { LogoMark } from "@/components/brand";

type P = { size?: number };

export const IconSessions = ({ size = 16 }: P) => <SquaresFour size={size} />;
export const IconBook = ({ size = 16 }: P) => <Books size={size} />;
export const IconBriefcase = ({ size = 16 }: P) => <Briefcase size={size} />;
export const IconHome = ({ size = 16 }: P) => <House size={size} />;
export const IconShield = ({ size = 16 }: P) => <ShieldCheck size={size} />;
export const IconLock = ({ size = 16 }: P) => <Lock size={size} />;
export const IconCheck = ({ size = 16 }: P) => <Check size={size} weight="bold" />;
export const IconCheckCircle = ({ size = 16 }: P) => <CheckCircle size={size} weight="fill" />;
export const IconAlert = ({ size = 16 }: P) => <Warning size={size} />;
export const IconClock = ({ size = 16 }: P) => <Clock size={size} />;
export const IconUpload = ({ size = 16 }: P) => <UploadSimple size={size} />;
export const IconChevron = ({ size = 16 }: P) => <CaretRight size={size} />;
export const IconArrow = ({ size = 16 }: P) => <ArrowRight size={size} />;
export const IconSpark = ({ size = 16 }: P) => <Sparkle size={size} weight="fill" color="#d97757" />;
export const IconPlay = ({ size = 16 }: P) => <Play size={size} />;
export const IconLogout = ({ size = 16 }: P) => <SignOut size={size} />;
export const IconPlus = ({ size = 16 }: P) => <Plus size={size} weight="bold" />;
export const IconCopy = ({ size = 16 }: P) => <Copy size={size} />;
export const IconSend = ({ size = 16 }: P) => <PaperPlaneTilt size={size} weight="fill" />;
export const IconEye = ({ size = 16 }: P) => <Eye size={size} />;
export const IconTerminal = ({ size = 16 }: P) => <TerminalGlyph size={size} />;
export const IconAgent = ({ size = 16 }: P) => <Robot size={size} />;

export function Logo({ size = 22 }: { size?: number }) {
  return <LogoMark size={size} />;
}
