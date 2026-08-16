import {
  EMPTY_BANK_USER_STATE,
  type BankUserState,
  type CustomPartition,
  type QuizBank,
} from "./bank-types";

export const BANK_USER_STATE_STORAGE_KEY = "quizdeck:bank-user-state:v1";

export type BankUserStates = Record<string, BankUserState | undefined>;

export type BankUserStateErrorCode =
  | "empty-partition-name"
  | "empty-partition-selection"
  | "empty-partition-id"
  | "duplicate-partition-id"
  | "invalid-partition-created-at"
  | "partition-not-found";

export class BankUserStateError extends Error {
  override readonly name = "BankUserStateError";

  constructor(readonly code: BankUserStateErrorCode) {
    super(code);
  }
}

function sanitizePartition(
  value: unknown,
  validQuestionIds: ReadonlySet<string>,
): CustomPartition | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const partition = value as Partial<CustomPartition>;
  if (
    typeof partition.id !== "string" ||
    typeof partition.name !== "string" ||
    !partition.name.trim() ||
    !Array.isArray(partition.questionIds) ||
    typeof partition.createdAt !== "string"
  ) {
    return null;
  }

  const questionIds = Array.from(
    new Set(
      partition.questionIds.filter(
        (id): id is string =>
          typeof id === "string" && validQuestionIds.has(id),
      ),
    ),
  );

  return {
    id: partition.id,
    name: partition.name.trim(),
    questionIds,
    createdAt: partition.createdAt,
  };
}

export function readBankUserStates(
  banks: readonly QuizBank[],
): BankUserStates {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(BANK_USER_STATE_STORAGE_KEY) ?? "{}",
    ) as Record<string, unknown>;
    const result: BankUserStates = {};

    for (const bank of banks) {
      const stored = value[bank.id];
      if (!stored || typeof stored !== "object") {
        result[bank.id] = { ...EMPTY_BANK_USER_STATE };
        continue;
      }

      const validQuestionIds = new Set(
        bank.questions.map((question) => question.id),
      );
      const state = stored as Partial<BankUserState>;
      result[bank.id] = {
        partitions: Array.isArray(state.partitions)
          ? state.partitions
              .map((partition) =>
                sanitizePartition(partition, validQuestionIds),
              )
              .filter(
                (partition): partition is CustomPartition => Boolean(partition),
              )
          : [],
        wrongQuestionIds: Array.isArray(state.wrongQuestionIds)
          ? Array.from(
              new Set(
                state.wrongQuestionIds.filter(
                  (id): id is string =>
                    typeof id === "string" && validQuestionIds.has(id),
                ),
              ),
            )
          : [],
      };
    }

    return result;
  } catch {
    return Object.fromEntries(
      banks.map((bank) => [bank.id, { ...EMPTY_BANK_USER_STATE }]),
    );
  }
}

export function writeBankUserStates(states: BankUserStates) {
  window.localStorage.setItem(
    BANK_USER_STATE_STORAGE_KEY,
    JSON.stringify(states),
  );
}

export function getBankUserState(
  states: BankUserStates,
  bankId: string,
): BankUserState {
  return states[bankId] ?? { ...EMPTY_BANK_USER_STATE };
}

export interface CustomPartitionInput {
  name: string;
  questionIds: readonly string[];
}

function normalizePartitionInput(
  bank: QuizBank,
  input: CustomPartitionInput,
) {
  const name = input.name.trim();
  if (!name) {
    throw new BankUserStateError("empty-partition-name");
  }

  const requestedIds = new Set(input.questionIds);
  const questionIds = bank.questions
    .map((question) => question.id)
    .filter((questionId) => requestedIds.has(questionId));
  if (questionIds.length === 0) {
    throw new BankUserStateError("empty-partition-selection");
  }

  return { name, questionIds };
}

export function createCustomPartition(
  state: BankUserState,
  bank: QuizBank,
  partition: CustomPartition,
): BankUserState {
  if (!partition.id.trim()) {
    throw new BankUserStateError("empty-partition-id");
  }
  if (state.partitions.some((item) => item.id === partition.id)) {
    throw new BankUserStateError("duplicate-partition-id");
  }
  if (
    !partition.createdAt ||
    Number.isNaN(Date.parse(partition.createdAt))
  ) {
    throw new BankUserStateError("invalid-partition-created-at");
  }

  const normalized = normalizePartitionInput(bank, partition);
  return {
    ...state,
    partitions: [
      ...state.partitions,
      {
        id: partition.id,
        createdAt: partition.createdAt,
        ...normalized,
      },
    ],
  };
}

export function updateCustomPartition(
  state: BankUserState,
  bank: QuizBank,
  partitionId: string,
  input: CustomPartitionInput,
): BankUserState {
  const partitionIndex = state.partitions.findIndex(
    (partition) => partition.id === partitionId,
  );
  if (partitionIndex < 0) {
    throw new BankUserStateError("partition-not-found");
  }

  const normalized = normalizePartitionInput(bank, input);
  const partitions = [...state.partitions];
  partitions[partitionIndex] = {
    ...partitions[partitionIndex],
    ...normalized,
  };

  return {
    ...state,
    partitions,
  };
}

export function deleteCustomPartition(
  state: BankUserState,
  partitionId: string,
): BankUserState {
  const partitions = state.partitions.filter(
    (partition) => partition.id !== partitionId,
  );
  if (partitions.length === state.partitions.length) {
    return state;
  }

  return {
    ...state,
    partitions,
  };
}

export function removeBankUserState(
  states: BankUserStates,
  bankId: string,
): BankUserStates {
  if (!(bankId in states)) {
    return states;
  }

  const next = { ...states };
  delete next[bankId];
  return next;
}
