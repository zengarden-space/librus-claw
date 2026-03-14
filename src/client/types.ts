export type PluginConfig = {
  username: string;
  password: string;
  sessionTtlMinutes?: number;
};

export type Grade = {
  id: number;
  value: string;
  info: string;
};

export type SubjectGrades = {
  name: string;
  semester: Array<{
    grades: Grade[];
    tempAverage: number;
    average: number;
  }>;
  tempAverage: number;
  average: number;
};

export type Absence = {
  id: number;
  type: string;
  date: string;
  subject: string;
  lessonHour: string;
  teacher: string;
};

export type AbsenceFrequency = {
  subject: string;
  percentage: number;
};

export type Homework = {
  id: number;
  subject: string;
  teacher: string;
  description: string;
  date: string;
  dueDate: string;
};

export type TimetableLesson = {
  subject: string;
  teacher: string;
  classroom: string;
  from: string;
  to: string;
};

export type TimetableDay = {
  date: string;
  lessons: TimetableLesson[];
};

export type Message = {
  id: number;
  folder: number;
  sender: string;
  subject: string;
  date: string;
  read: boolean;
};

export type MessageContent = Message & {
  body: string;
};

export type AccountInfo = {
  student: {
    nameSurname: string;
    class: string;
    index: string;
    educator: string;
  };
  account: {
    nameSurname: string;
    login: string;
  };
};
