---
"@mariodebono/di-config": patch
---

Fix configuration validation with Zod 4.6 schemas by preferring `safeParse()` and `parse()` over Joi-style `validate()`. Valid configuration retains parsed values, defaults and transforms, while invalid configuration throws instead of returning undefined. Custom validation callbacks and Joi-style validation remain supported.
