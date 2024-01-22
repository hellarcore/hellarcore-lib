export type LLMQ_TYPES = {
  // 50 members, 30 (60%) threshold, one per hour (24 blocks)
  LLMQ_TYPE_50_60: 1,

  // 400 members, 240 (60%) threshold, one every 12 hours (288 blocks)
  LLMQ_TYPE_400_60: 2,

  // 400 members, 340 (85%) threshold, one every 24 hours (576 blocks)
  LLMQ_TYPE_400_85: 3,

  // 100 members, 67 (67%) threshold, one every 24 hours (576 blocks)
  LLMQ_TYPE_100_67: 4,

  // 60 members, 45 (75%) threshold, one every 12 hours
  LLMQ_TYPE_60_75: 5,

  // 25 members, 67 (67%) threshold, one per hour
  LLMQ_TYPE_25_67: 6,

  // 3 members, 2 (66%) threshold, one per hour (24 blocks)
  // Params might differ when -llmqtestparams is used
  LLMQ_TYPE_LLMQ_TEST: 100,

  // 12 members, 6 (60%) threshold, one per hour (24 blocks)
  // Params might differ when -llmqdevnetparams is used
  LLMQ_TYPE_LLMQ_DEVNET: 101,

  // 3 members, 2 (66%) threshold, one per hour.
  // Params might differ when -llmqtestparams is used
  LLMQ_TYPE_TEST_V17: 102,

  // 4 members, 2 (66%) threshold, one per hour.
  // Params might differ when -llmqtestparams is used
  LLMQ_TYPE_TEST_DIP0024: 103,

  // 3 members, 2 (66%) threshold, one per hour.
  // Params might differ when -llmqtestinstantsendparams is used
  LLMQ_TYPE_TEST_INSTANTSEND: 104,

  // 8 members, 4 (50%) threshold, one per hour.
  // Params might differ when -llmqdevnetparams is used
  // for devnets only. rotated version (v2) for devnets
  LLMQ_DEVNET_DIP0024: 105,
  // for testing only
  // 3 members, 2 (67%) threshold, one per hour.
  LLMQ_TEST_PLATFORM: 106,
  // for devnet testing only
  // 12 members, 8 (67%) threshold, one per hour
  LLMQ_DEVNET_PLATFORM: 107,
}
