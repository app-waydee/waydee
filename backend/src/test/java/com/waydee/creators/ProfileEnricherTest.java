package com.waydee.creators;

import static org.assertj.core.api.Assertions.assertThat;

import com.waydee.creators.application.ProfileEnricher;
import com.waydee.creators.domain.Platform;
import org.junit.jupiter.api.Test;

class ProfileEnricherTest {

    @Test
    void parsesInstagramAndTiktokFollowersFromOpenGraph() {
        String ig = "<meta property=\"og:description\" content=\"6M Followers, 580 Following, 280 Posts - See\" />";
        String tt = "<meta property=\"og:description\" content=\"@khaby.lame 163.0m Followers, 81 Following\"/>";
        String small = "<meta content=\"12,345 Followers, 10 Following\" property=\"og:description\">";
        assertThat(ProfileEnricher.followersOf(Platform.INSTAGRAM, ig)).isEqualTo(6_000_000L);
        assertThat(ProfileEnricher.followersOf(Platform.TIKTOK, tt)).isEqualTo(163_000_000L);
        assertThat(ProfileEnricher.followersOf(Platform.INSTAGRAM, small)).isEqualTo(12_345L);
    }

    @Test
    void parsesYoutubeSubscribers() {
        String yt = "\"subscriberCountText\":{\"accessibility\":{},\"simpleText\":\"1.16M subscribers\"}";
        assertThat(ProfileEnricher.followersOf(Platform.YOUTUBE, yt)).isEqualTo(1_160_000L);
    }

    @Test
    void unknownWhenPageHasNoCount() {
        assertThat(ProfileEnricher.followersOf(Platform.X, "<html></html>")).isNull();
    }
}
