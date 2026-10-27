-- Criminal matters are a first-class case type and lawyer specialty.
ALTER TYPE "CaseType" ADD VALUE IF NOT EXISTS 'CRIMINAL';
