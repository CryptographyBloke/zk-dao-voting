template ScaleTest(N) {
    signal input in;
    signal output out;
    signal arr[N];
    arr[0] <== in * in;
    for (var i = 1; i < N; i++) {
        arr[i] <== arr[i-1] * in + 1;
    }
    out <== arr[N-1];
}
component main = ScaleTest(70000);
