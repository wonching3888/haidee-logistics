-- Driver JV export (step 1): per-driver AutoCount account code suffix.

ALTER TABLE "drivers" ADD COLUMN "account_code_suffix" TEXT;

UPDATE "drivers" SET "account_code_suffix" = 'HLIM' WHERE "full_name" = 'Abdul Halim Bin Ahmad';
UPDATE "drivers" SET "account_code_suffix" = 'WANG' WHERE "full_name" = 'Sharif Bin Mat';
UPDATE "drivers" SET "account_code_suffix" = 'PEIN' WHERE "full_name" = 'Mohd Azrin Bin Mohd Sadri';
UPDATE "drivers" SET "account_code_suffix" = 'WAN1' WHERE "name" = 'Wan' AND "full_name" = 'Mustafa';
UPDATE "drivers" SET "account_code_suffix" = 'WAN1' WHERE "full_name" = 'Wan SyafirulHafiq Bin Wan Mustafa';
UPDATE "drivers" SET "account_code_suffix" = 'OWN1' WHERE "full_name" = 'Muhammad Asrul Bin Abdul Jalil';
UPDATE "drivers" SET "account_code_suffix" = 'ROZA' WHERE "full_name" = 'Rozaime Bin Othman';
UPDATE "drivers" SET "account_code_suffix" = 'FOOK' WHERE "full_name" = 'Yong Ah Fook';
UPDATE "drivers" SET "account_code_suffix" = 'FAIZ' WHERE "full_name" = 'Ku Mohd Faizal Bin Ku Aziz';
UPDATE "drivers" SET "account_code_suffix" = 'AKIM' WHERE "full_name" = 'Muhammad Hakim Bin Mat Sarip';
UPDATE "drivers" SET "account_code_suffix" = 'NAIM' WHERE "full_name" = 'Mohamad Naim Bin Zulkefli';
UPDATE "drivers" SET "account_code_suffix" = 'AZAR' WHERE "full_name" = 'Norazhar Bin Baharom';
UPDATE "drivers" SET "account_code_suffix" = 'PNAT' WHERE "full_name" = 'Mohd Shafinar Bin Abdullah';
UPDATE "drivers" SET "account_code_suffix" = 'DIN1' WHERE "full_name" = 'Khairuddin Bin Hashim';
UPDATE "drivers" SET "account_code_suffix" = 'IMAL' WHERE "full_name" = 'Mohd Ikmal Hisham Bin Hanapi';
