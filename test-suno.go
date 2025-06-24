package main

import (
    "context"
    "fmt"
    "log"
    "time"
    
    "github.com/igolaizola/musikai/pkg/suno"
)

func main() {
    // Cookie store that returns the cookie directly
    cookieStore := &simpleCookieStore{
        cookie: `_cfuvid=nlgE6x5rFs0IQohSQ8cx1rjqMla_MmfLfDatePLBv5I-1750558507512-0.0.1.1-604800000; ajs_anonymous_id=108c9c6c-9b04-41b7-b0fd-557c279ab88b; __stripe_mid=1a6095ce-95e2-47f1-a387-c42164d1e94a4751c5; __client=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNsaWVudF8yeXFPQ0l3WkxrUldRMGlzR1FyOG0yN0l5ajIiLCJyb3RhdGluZ190b2tlbiI6IjlxeWk4OThtdm44ZDAyZ2kzZ2VmdmJ2ZXMwY3Nma2dqbmdhN2JnNDIifQ.PiC2poSFkTAQIFVNXDLOHF8mOMIYdaH1HAjqHnd8pHFqX-gBRrH1gZlz6IZGXKQTcjWmmEEEfJQi7fENPS_D69he6pxNisgj8uV_7M9YeGL2TTOi0Q57vrX0sQN26C1-k3Lgu6NBCKVtpbhXj7Ix12P4ilm_5xuHwUsln2Qx1_9DBVsQXbZMj3vZiut_QcHISThsfohCDrYosFRVVoxydCPQNy-bX5tRMDSv_kR1D13WQVItIvsPTWY8Dy6N-MoCO9d_aBNLTB_sJjG_oWGNwsRIJOxwoUETlBNsnMW_Nh9EEWHZw96n64aFRxUyuFAap6OJzGOlLOm5V0FEus0JZg; __client_uat=1750558523; __client_uat_U9tcbTPE=1750558523; __stripe_sid=d0d3b49b-af61-4823-9d02-73d795939fea771d00; __cf_bm=WKM8YJX9vs66lpOdMs67ajj5dERvzoovPkGjApCUS1M-1750566790-1.0.1.1-PKUrh_oxDIQ.RCB5DeS7QfnrPSgIfiY5i9esjixd706J3lYT_FrnfmKfZfCwTw23DAUxUNSRVl6vSyzgv6gXVINcKT8H3__fUE4fnUARJ98`,
    }
    
    cfg := &suno.Config{
        Wait:        time.Second,
        Debug:       true,
        CookieStore: cookieStore,
    }
    
    client := suno.New(cfg)
    ctx := context.Background()
    
    fmt.Println("Testing Suno authentication...")
    err := client.Auth(ctx)
    if err != nil {
        log.Fatalf("Auth failed: %v", err)
    }
    
    fmt.Println("Authentication successful!")
}

type simpleCookieStore struct {
    cookie string
}

func (s *simpleCookieStore) GetCookie(ctx context.Context) (string, error) {
    return s.cookie, nil
}

func (s *simpleCookieStore) SetCookie(ctx context.Context, cookie string) error {
    return nil
}