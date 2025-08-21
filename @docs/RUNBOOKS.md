# Runbooks

This document contains troubleshooting guides and runbooks for common operational issues.

## Table of Contents
- [Stuck Music Generation](#stuck-music-generation)
- [Missing R2 Objects](#missing-r2-objects)
- [Provider API Failures](#provider-api-failures)
- [Billing Webhook Failures](#billing-webhook-failures)
- [Database Connection Issues](#database-connection-issues)

## Stuck Music Generation

### Symptoms
- Songs remain in `generating` status for >15 minutes
- Users report that their music generation is not completing
- API calls to `/api/music/status` return stale data

### Diagnosis
1. Check the reconciler logs:
   ```bash
   curl http://localhost:3000/health?reconciler=true
   # or
   curl http://localhost:3000/api/reconciler
   ```

2. Query the database for stuck generations:
   ```sql
   SELECT id, generation_id, status, created_at, updated_at
   FROM songs
   WHERE status = 'generating'
     AND updated_at < NOW() - INTERVAL '15 minutes';
   ```

3. Check ElevenLabs API status:
   ```bash
   curl -H "xi-api-key: YOUR_API_KEY" https://api.elevenlabs.io/v1/music/status/YOUR_GENERATION_ID
   ```

### Resolution Steps
1. **Automatic Resolution**: The reconciler runs automatically and will:
   - Check status with ElevenLabs
   - Mark as `completed` if generation finished
   - Mark as `failed` if generation is truly stuck

2. **Manual Resolution**:
   - Run the reconciler manually: `GET /health?reconciler=true`
   - Check ElevenLabs dashboard for the generation status
   - If completed, manually update the database:
     ```sql
     UPDATE songs
     SET status = 'completed',
         r2_url = 'PUBLIC_R2_URL',
         updated_at = NOW()
     WHERE id = 'STUCK_SONG_ID';
     ```

3. **Prevention**:
   - Ensure reconciler is running every 5 minutes
   - Monitor error rates via `/api/metrics?operation=elevenlabs_fetch_status`
   - Check API key validity and quota limits

## Missing R2 Objects

### Symptoms
- Songs marked as `completed` but audio doesn't play
- 404 errors when accessing R2 URLs
- Users report missing audio files

### Diagnosis
1. Check if R2 object exists:
   ```bash
   # Using AWS CLI or R2 console
   aws s3 ls s3://your-bucket/music/SONG_ID.mp3 --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   ```

2. Check database for R2 key:
   ```sql
   SELECT id, r2_key, r2_url, status FROM songs WHERE id = 'SONG_ID';
   ```

3. Verify R2 credentials and bucket configuration

### Resolution Steps
1. **If R2 object is missing but generation completed**:
   - Re-download from ElevenLabs using the `generation_id`
   - Upload to R2 with the correct key
   - Update database record

2. **If R2 URL is malformed**:
   - Regenerate the public URL using the R2 key
   - Update the `r2_url` field in the database

3. **If multiple objects are missing**:
   - Query for all completed songs without R2 objects:
     ```sql
     SELECT id, generation_id, r2_key
     FROM songs
     WHERE status = 'completed'
       AND (r2_key IS NULL OR r2_url IS NULL);
     ```
   - Create a script to re-download and re-upload missing files

### Prevention
- Monitor R2 upload success rates via metrics
- Implement checksum verification for uploaded files
- Set up R2 lifecycle rules to prevent accidental deletion
- Regular backups of critical R2 objects

## Provider API Failures

### Symptoms
- Music generation requests fail immediately
- 4xx/5xx errors from ElevenLabs/Fal.ai
- Increased error rates in metrics

### Diagnosis
1. Check provider API status pages
2. Verify API keys and permissions
3. Check quota and rate limits
4. Review error messages in logs

### Resolution Steps
1. **API Key Issues**:
   - Verify API key validity in provider dashboard
   - Check if key has required permissions
   - Rotate key if compromised

2. **Quota Exceeded**:
   - Check usage in provider dashboard
   - Upgrade plan or wait for quota reset
   - Implement usage alerts

3. **Rate Limiting**:
   - Implement exponential backoff (already implemented)
   - Reduce concurrent requests
   - Consider request queuing

4. **Service Outages**:
   - Check provider status page
   - Implement circuit breaker pattern
   - Fail gracefully with user notification

### Prevention
- Monitor error rates and latency metrics
- Set up alerts for increased error rates
- Implement graceful degradation
- Have backup providers ready (future)

## Billing Webhook Failures

### Symptoms
- Stripe webhooks return 5xx errors
- User subscriptions not updating
- Payment issues reported by users

### Diagnosis
1. Check webhook logs:
   ```bash
   # Check application logs for webhook errors
   grep "webhook" /var/log/app.log
   ```

2. Verify webhook signature validation
3. Check database connectivity during webhook processing

### Resolution Steps
1. **Signature Verification Issues**:
   - Verify webhook secret matches Stripe dashboard
   - Check timestamp tolerance (default 300 seconds)
   - Ensure system clock is synchronized

2. **Database Connection Issues**:
   - Check Supabase connection
   - Verify RLS policies allow webhook operations
   - Check for database locks or deadlocks

3. **Idempotency Issues**:
   - Ensure webhook has proper idempotency key handling
   - Check for duplicate event processing
   - Verify event storage and retrieval

### Recovery
1. **Replay Failed Webhooks**:
   ```bash
   # Use Stripe CLI to replay webhooks
   stripe events resend EVENT_ID --livemode
   ```

2. **Manual Sync**:
   - Query Stripe API for recent subscriptions
   - Update database manually if needed
   - Verify user access levels

### Prevention
- Implement comprehensive webhook logging
- Set up monitoring and alerts for webhook failures
- Test webhook endpoints regularly
- Maintain idempotency across all webhook operations

## Database Connection Issues

### Symptoms
- Application returns 500 errors
- Slow response times
- Database-related error messages

### Diagnosis
1. Check Supabase dashboard for metrics
2. Monitor connection pool usage
3. Check for long-running queries
4. Verify network connectivity

### Resolution Steps
1. **Connection Pool Exhaustion**:
   - Increase connection pool size
   - Implement connection pooling with proper cleanup
   - Check for connection leaks

2. **Long-running Queries**:
   - Identify slow queries using Supabase dashboard
   - Add appropriate indexes
   - Optimize query performance

3. **Network Issues**:
   - Check network connectivity to Supabase
   - Verify DNS resolution
   - Check firewall rules

### Prevention
- Monitor database metrics regularly
- Set up alerts for high connection usage
- Implement query timeouts
- Regular database maintenance

## Monitoring Commands

### Check System Health
```bash
# Health check
curl http://localhost:3000/health

# With reconciler run
curl http://localhost:3000/health?reconciler=true
```

### Check Metrics
```bash
# All metrics summary
curl http://localhost:3000/api/metrics

# Specific operation metrics
curl http://localhost:3000/api/metrics?operation=elevenlabs_start_generation
```

### Database Queries
```sql
-- Check stuck generations
SELECT status, COUNT(*) as count
FROM songs
GROUP BY status;

-- Check recent errors
SELECT operation, COUNT(*) as error_count
FROM metrics_table
WHERE success = false
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY operation;
```

## Alert Configuration

Configure alerts for:
- Error rate > 5% for any operation
- Generation time > 30 minutes
- Database connection issues
- R2 upload failures
- Webhook processing failures

## Log Analysis

Key log patterns to monitor:
- `ERROR.*elevenlabs.*failed`
- `ERROR.*webhook.*failed`
- `WARN.*timeout`
- `ERROR.*database.*connection`

Regular log analysis helps identify emerging issues before they become critical.
