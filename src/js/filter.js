import cv from "@techstark/opencv-js";

const filter = {
    /**
     * Applies Automatic Equal-Separated Histogram Equalization (AESHE) to enhance the contrast of an image.
     * @param {cv.Mat} src - The source image.
     * @returns {cv.Mat}
     */
    AESHE: function(src) {
        // Convert the image to the HSV color space
        let hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);

        // Split the HSV image into its three channels
        let channels = new cv.MatVector();
        cv.split(hsv, channels);
        let vChannel = channels.get(2); // Value channel

        // Calculate the histogram and cumulative distribution function (CDF) for the V channel
        let srcVec = new cv.MatVector();
        srcVec.push_back(vChannel);
        let hist = new cv.Mat();
        let mask = new cv.Mat();
        let histSize = [256];
        let ranges = [0, 256];
        cv.calcHist(srcVec, [0], mask, hist, histSize, ranges, false);

        // console.log(hist);

        // Calculate the PDF and CDF
        let cdf = new Array(256).fill(0);
        let totalPixels = 0;
        for (let i = 0; i < 256; i++) {
            totalPixels += hist.data32F[i];
        }
        for (let i = 0; i < 256; i++) {
            cdf[i] = (i === 0 ? hist.data32F[i] : cdf[i - 1] + hist.data32F[i]);
        }
        for (let i = 0; i < 256; i++) {
            cdf[i] = cdf[i] / totalPixels;
        }
        // Helper function for binary search
        function findThresholdIndex(arr, value) {
            let low = 0;
            let high = arr.length - 1;
            while (low <= high) {
                let mid = Math.floor((low + high) / 2);
                if (arr[mid] < value) {
                    low = mid + 1;
                } else if (arr[mid] > value) {
                    high = mid - 1;
                } else {
                    return mid;
                }
            }
            return low;
        }

        // Automatic equal-separated histogram equalization
        let t = 2;
        let previousMeanT = -1;
        let equalSeparatedThresholds = [];
        let iterations = 0;
        while (true) {
            equalSeparatedThresholds = Array.from({ length: t + 1 }, (_, i) => findThresholdIndex(cdf, i / t));
            let meanT = equalSeparatedThresholds.reduce((a, b) => a + b) / equalSeparatedThresholds.length;

            if (Math.abs(meanT -previousMeanT) < 0.0001) {
                break;
            }

            previousMeanT = meanT;
            t += 1;
        }
        // console.log(equalSeparatedThresholds);
        // Piecewise transformation function
        let lut = new Uint8Array(256);
        for (let i = 0; i < t; i++) {
            let start = equalSeparatedThresholds[i];
            let end = equalSeparatedThresholds[i + 1];
            let cdfStart = cdf[start];
            let cdfEnd = cdf[end];
            let range = end - start;
            let cdfRange = cdfEnd - cdfStart;

            for (let j = start; j <= end; j++) {
                lut[j] = Math.round(((j - start) / range) * cdfRange * 255 + cdfStart * 255);
            }
        }
        // console.log(lut);
        lut[255] = 255;
        // Apply the LUT to the V channel
        let equalizedVChannel = new cv.Mat();
        cv.LUT(vChannel, cv.matFromArray(256, 1, cv.CV_8U, lut), equalizedVChannel);

        // Replace the original V channel with the enhanced V channel
        channels.set(2, equalizedVChannel);

        // Merge the channels back together
        let enhancedHSV = new cv.Mat();
        cv.merge(channels, enhancedHSV);

        // Convert the enhanced HSV image back to the RGB color space
        let dst = new cv.Mat();
        cv.cvtColor(enhancedHSV, dst, cv.COLOR_HSV2RGB);

        // Clean up
        hsv.delete();
        vChannel.delete();
        enhancedHSV.delete();
        channels.delete();
        equalizedVChannel.delete();
        srcVec.delete();
        hist.delete();
        mask.delete();

        return dst;
    },

    /**
     * Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) to enhance the contrast of an image in the YUV color space.
     * @param {cv.Mat} src - The source image.
     * @returns {cv.Mat}
     */
    CLAHE: function(src) {
        // Convert the image to the YUV color space
        let yuv = new cv.Mat();
        cv.cvtColor(src, yuv, cv.COLOR_RGB2YUV);

        // Split the YUV image into its three channels
        let channels = new cv.MatVector();
        cv.split(yuv, channels);
        let yChannel = channels.get(0);

        // Apply CLAHE to the Y channel
        let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));  // Clip limit and grid size
        let enhancedYChannel = new cv.Mat();
        clahe.apply(yChannel, enhancedYChannel);

        // Replace the original Y channel with the enhanced Y channel
        channels.set(0, enhancedYChannel);

        // Merge the channels back together
        let enhancedYUV = new cv.Mat();
        cv.merge(channels, enhancedYUV);

        // Convert the enhanced YUV image back to the RGB color space
        let dst = new cv.Mat();
        cv.cvtColor(enhancedYUV, dst, cv.COLOR_YUV2RGB);

        // Clean up
        yuv.delete();
        yChannel.delete();
        enhancedYChannel.delete();
        channels.delete();
        enhancedYUV.delete();
        clahe.delete();

        return dst;
    },

    createLookupTable: function (input, output) {
        let lut = new Uint8Array(256);
        let inputIndex = 0;
        for (let i = 0; i < 256; i++) {
            if (i > input[inputIndex + 1]) {
                inputIndex++;
            }
            let range = input[inputIndex + 1] - input[inputIndex];
            let valueRange = output[inputIndex + 1] - output[inputIndex];
            if (range == 0) {
                lut[i] = output[inputIndex];
            } else {
                lut[i] = output[inputIndex] + (i - input[inputIndex]) * valueRange / range;
            }
        }
        return lut;
    },
    
    Winter: function (img) {
        let increaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 80, 160, 256]);
        let decreaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 50, 100, 256]);
    
        // Split the channels
        let channels = new cv.MatVector();
        cv.split(img, channels);
        let blue_channel = channels.get(2);
        let green_channel = channels.get(1);
        let red_channel = channels.get(0);
    
        // Apply LUTs
        let blue_channel_enhanced = new cv.Mat();
        let red_channel_enhanced = new cv.Mat();
        cv.LUT(blue_channel, cv.matFromArray(256, 1, cv.CV_8U, increaseLookupTable), blue_channel_enhanced);
        cv.LUT(red_channel, cv.matFromArray(256, 1, cv.CV_8U, decreaseLookupTable), red_channel_enhanced);
    
        // Merge the channels back
        let win = new cv.Mat();
        channels.set(0, red_channel_enhanced);
        channels.set(1, green_channel);
        channels.set(2, blue_channel_enhanced);

        cv.merge(channels, win);
    
        // Clean up
        blue_channel.delete();
        green_channel.delete();
        red_channel.delete();
        blue_channel_enhanced.delete();
        red_channel_enhanced.delete();
        channels.delete();
    
        return win;
    },

    Summer: function (img) {
        let increaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 80, 160, 256]);
        let decreaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 50, 100, 256]);
    
        // Split the channels
        let channels = new cv.MatVector();
        cv.split(img, channels);
        let blue_channel = channels.get(2);
        let green_channel = channels.get(1);
        let red_channel = channels.get(0);
    
        // Apply LUTs
        let blue_channel_enhanced = new cv.Mat();
        let red_channel_enhanced = new cv.Mat();
        cv.LUT(red_channel, cv.matFromArray(256, 1, cv.CV_8U, increaseLookupTable), red_channel_enhanced);
        cv.LUT(blue_channel, cv.matFromArray(256, 1, cv.CV_8U, decreaseLookupTable), blue_channel_enhanced);
    
        // Merge the channels back
        let sum = new cv.Mat();
        channels.set(0, red_channel_enhanced);
        channels.set(1, green_channel);
        channels.set(2, blue_channel_enhanced);

        cv.merge(channels, sum);
    
        // Clean up
        blue_channel.delete();
        green_channel.delete();
        red_channel.delete();
        blue_channel_enhanced.delete();
        red_channel_enhanced.delete();
        channels.delete();
    
        return sum;
    },

    adjustColorTemperature: function (img, adjustment) {
        // Split the channels
        let channels = new cv.MatVector();
        cv.split(img, channels);
        let blue_channel = channels.get(0);
        let green_channel = channels.get(1);
        let red_channel = channels.get(2);
    
        // Create lookup tables
        let increaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 64 + adjustment, 128 + adjustment, 256]);
        let decreaseLookupTable = this.createLookupTable([0, 64, 128, 256], [0, 64 - adjustment, 128 - adjustment, 256]);
    
        // Apply LUTs
        let blue_channel_adjusted = new cv.Mat();
        let red_channel_adjusted = new cv.Mat();
        cv.LUT(blue_channel, cv.matFromArray(256, 1, cv.CV_8U, increaseLookupTable), blue_channel_adjusted);
        cv.LUT(red_channel, cv.matFromArray(256, 1, cv.CV_8U, decreaseLookupTable), red_channel_adjusted);
    
        // Merge the channels back
        let adjustedImage = new cv.Mat();
        let mergedChannels = new cv.MatVector();
        mergedChannels.push_back(blue_channel_adjusted);
        mergedChannels.push_back(green_channel);
        mergedChannels.push_back(red_channel_adjusted);
        cv.merge(mergedChannels, adjustedImage);
    
        // Clean up
        blue_channel.delete();
        green_channel.delete();
        red_channel.delete();
        blue_channel_adjusted.delete();
        red_channel_adjusted.delete();
        channels.delete();
        mergedChannels.delete();
    
        return adjustedImage;
    },

    readAndConvert(mat) {
        const labMat = new cv.Mat();
        cv.cvtColor(mat, labMat, cv.COLOR_RGB2Lab);
        console.log(labMat);
        return labMat;
    },

    applyMultiThreshold(labMat) {
        const channels = new cv.MatVector();
        cv.split(labMat, channels);
        const lChannel = channels.get(0);

        const thresholdValue = cv.threshold(lChannel, lChannel, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        // console.log("thresholdvalue :", thresholdValue);
        const segmentedMat = new cv.Mat();
        cv.threshold(lChannel, segmentedMat, thresholdValue, 255, cv.THRESH_BINARY);

        channels.delete();
        lChannel.delete();

        return segmentedMat;
    },

    calculateMean(array) {
        const sum = array.reduce((a, b) => a + b, 0);
        return sum / array.length;
    },
    
    calculateStd(array, mean) {
        const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / array.length;
        return Math.sqrt(variance);
    },

    colorTransfer(sourceLab, targetLab, mask) {
        const matched = new cv.Mat();
        targetLab.copyTo(matched);
        const maskResized = new cv.Mat();
        cv.resize(mask, maskResized, new cv.Size(targetLab.cols, targetLab.rows), 0, 0, cv.INTER_LINEAR);

        const channelsSource = new cv.MatVector();
        const channelsTarget = new cv.MatVector();
        const channelsMatched = new cv.MatVector();

        cv.split(sourceLab, channelsSource);
        cv.split(targetLab, channelsTarget);
        cv.split(matched, channelsMatched);

        const uniqueRegions = Array.from(new Set(maskResized.data));
        // console.log(uniqueRegions)
        uniqueRegions.forEach(region => {
            // if (region != 0) return;
            // console
            const regionMask = new cv.Mat();
            const lowerb = cv.matFromArray(1, 1, cv.CV_8U, [parseInt(region)]);
            const upperb = cv.matFromArray(1, 1, cv.CV_8U, [parseInt(region)]);

            cv.inRange(maskResized, lowerb, upperb, regionMask);
            cv.threshold(regionMask, regionMask, 0, 1, cv.THRESH_BINARY);
            // console.log(regionMask.data);
            for (let channel = 0; channel < 3; channel++) {
                const sourceRegion = new cv.Mat();
                const targetRegion = new cv.Mat();
                channelsSource.get(channel).copyTo(sourceRegion, regionMask);
                channelsTarget.get(channel).copyTo(targetRegion, regionMask);

                const sourceData = new Float32Array(sourceRegion.data);
                const targetData = new Float32Array(targetRegion.data);
    
                const srcMean = this.calculateMean(sourceData);
                const srcStd = this.calculateStd(sourceData, srcMean);
                // console.log("src:", srcMean, srcStd);
                const tarMean = this.calculateMean(targetData);
                const tarStd = this.calculateStd(targetData, tarMean);
    
                const sourceNormalized = sourceData.map(value => (value - srcMean) / (srcStd + 1e-10));
                const sourceScaled = sourceNormalized.map(value => value * tarStd + tarMean);
    
                const sourceScaledUint8 = new Uint8Array(sourceScaled.map(value => Math.min(Math.max(value, 0), 255)));
                const sourceScaledMat = cv.matFromArray(sourceRegion.rows, sourceRegion.cols, sourceRegion.type(), sourceScaledUint8);
    
                sourceScaledMat.copyTo(channelsMatched.get(channel), regionMask);
    
                sourceRegion.delete();
                targetRegion.delete();
                sourceScaledMat.delete();
            }

            regionMask.delete();
            lowerb.delete();
            upperb.delete();
        });

        cv.merge(channelsMatched, matched);

        maskResized.delete();
        channelsSource.delete();
        channelsTarget.delete();
        channelsMatched.delete();

        return matched;
    },

    processImages(contentMat, targetMat) {
        console.log(contentMat);
        const contentLab = this.readAndConvert(contentMat);
        const targetLab = this.readAndConvert(targetMat);
        const contentSegments = this.applyMultiThreshold(contentLab);

        const resizedTargetLab = new cv.Mat();
        cv.resize(targetLab, resizedTargetLab, new cv.Size(contentLab.cols, contentLab.rows), 0, 0, cv.INTER_LINEAR);
        console.log(contentLab);
        const transferred = this.colorTransfer(contentLab, resizedTargetLab, contentSegments);
        const transferredRgb = new cv.Mat();
        cv.cvtColor(transferred, transferredRgb, cv.COLOR_Lab2RGB);

        // Clean up intermediate matrices
        contentLab.delete();
        targetLab.delete();
        contentSegments.delete();
        resizedTargetLab.delete();
        transferred.delete();

        return transferredRgb;
    }
    
};

export default filter;
