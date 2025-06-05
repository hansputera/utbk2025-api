export type University = {
  code: string;
  name: string;
  passers: number;
  isTopFive: number;
  kipUsers: number;
  country?: string;
  logo?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
};

export type Stats = {
  totalRegistrants: number;
  totalPassers: number;
  totalFailures: number;
  kipParticipant: number;
}

export type Program = {
  code: string;
  name: string;
  passers: number;
  isTopFive: number;
  kip: number;
}

export type Passers = {
  name: string;
  utbkNumber: string;
  program: string;
  id: string;
}

export type StudentQuery = {
  name: string;
  utbkNumber: string;
  dob: string;
  kip: boolean;
  passed: boolean;
}
