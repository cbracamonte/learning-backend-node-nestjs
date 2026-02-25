class Metrics {
  processed = 0;
  valid = 0;
  invalid = 0;
  failed = 0;

  incrementProcessed() {
    this.processed++;
  }
  incrementValid() {
    this.valid++;
  }
  incrementInvalid() {
    this.invalid++;
  }
  incrementFailed() {
    this.failed++;
  }

  snapshot(){
    return {
        processed: this.processed,
        valid: this.valid,
        invalid: this.invalid,
        failed: this.failed
    }
  }
}

export const metrics = new Metrics();
