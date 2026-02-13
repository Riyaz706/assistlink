# Email Requirements for Testing

## Email Validation Rules

### ✅ What You CAN Do:

1. **Use Any Valid Email Format**
   - Real emails: `john.doe@example.com`
   - Test emails: `test@test.com`, `user1@demo.com`
   - Disposable emails: `test@mailinator.com`
   - Format just needs to be valid (user@domain.com)

2. **Use Different Emails for Each Test**
   - `test1@example.com`
   - `test2@example.com`
   - `caregiver1@test.com`
   - `recipient1@test.com`

### ❌ What You CANNOT Do:

1. **Register the Same Email Twice**
   - Each email must be **unique**
   - If you try to register `test@example.com` twice, you'll get an error
   - Error: "User with this email already exists"

2. **Use Invalid Email Format**
   - `notanemail` ❌
   - `@example.com` ❌
   - `test@` ❌
   - `test.example.com` ❌

## Testing Strategy

### Option 1: Use Sequential Test Emails
```
test1@example.com
test2@example.com
test3@example.com
caregiver1@test.com
caregiver2@test.com
```

### Option 2: Use Timestamp-Based Emails
```
test_20250105_001@example.com
test_20250105_002@example.com
```

### Option 3: Use Role-Based Emails
```
care_recipient_1@test.com
care_recipient_2@test.com
caregiver_1@test.com
caregiver_2@test.com
```

## Email Uniqueness

**Important**: Supabase Auth enforces email uniqueness at the database level. You **cannot** register the same email address twice, even if you delete the first account.

### If You Need to Reuse an Email:

1. **Delete the user from Supabase Dashboard**:
   - Go to Supabase Dashboard → Authentication → Users
   - Find and delete the user
   - Then you can register again with that email

2. **Use a different email** (easier for testing)

## Example Test Scenarios

### Scenario 1: Register Two Care Recipients
```
User 1:
  email: "recipient1@test.com"
  role: "care_recipient"

User 2:
  email: "recipient2@test.com"  (must be different!)
  role: "care_recipient"
```

### Scenario 2: Register Care Recipient + Caregiver
```
Care Recipient:
  email: "recipient@test.com"
  role: "care_recipient"

Caregiver:
  email: "caregiver@test.com"  (must be different!)
  role: "caregiver"
```

## Quick Testing Tips

1. **For quick testing**, use simple patterns:
   ```
   test1@test.com
   test2@test.com
   test3@test.com
   ```

2. **For organized testing**, use descriptive emails:
   ```
   john_recipient@test.com
   jane_caregiver@test.com
   ```

3. **Keep a list** of emails you've used to avoid duplicates

4. **Don't worry about email verification** - Supabase can work without email confirmation for testing (depending on your settings)

## Summary

✅ **Email must be:**
- Valid format (user@domain.com)
- Unique (not already registered)

✅ **Email does NOT need to:**
- Be a real, working email address
- Be verified (for testing)
- Belong to an actual person

❌ **You CANNOT:**
- Register the same email twice
- Use invalid email formats

